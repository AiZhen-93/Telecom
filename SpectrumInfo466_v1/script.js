const siteAssetBase = new URL(".", document.currentScript?.src || window.location.href);
const assetPath = (path) => {
    if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) {
        return path;
    }
    return new URL(path, siteAssetBase).toString();
};

const visitCounterEndpoint = "https://aizhen-visit-counter.2010magnitude.workers.dev/hit";
const updateVisitCount = async () => {
    const counters = document.querySelectorAll("[data-visit-count]");
    if (!counters.length) {
        return;
    }

    try {
        const response = await fetch(visitCounterEndpoint, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Visit counter responded with ${response.status}`);
        }

        const data = await response.json();
        const count = Number(data.count);
        if (!Number.isFinite(count)) {
            throw new Error("Visit counter response did not include a numeric count.");
        }

        counters.forEach((counter) => {
            counter.textContent = count.toLocaleString("zh-TW");
        });
    } catch (error) {
        counters.forEach((counter) => {
            counter.textContent = "--";
        });
    }
};

updateVisitCount();

document.querySelectorAll(".footer-back-top").forEach((button) => {
    button.addEventListener("click", (event) => {
        event.preventDefault();
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "smooth",
        });
    });
});

document.querySelectorAll(".has-submenu > .nav-trigger").forEach((button) => {
    button.addEventListener("click", () => {
        const item = button.closest(".has-submenu");
        const isOpen = item.classList.toggle("open");
        button.setAttribute("aria-expanded", String(isOpen));

        document.querySelectorAll(".has-submenu.open").forEach((otherItem) => {
            if (otherItem !== item) {
                otherItem.classList.remove("open");
                const otherButton = otherItem.querySelector(".nav-trigger");
                if (otherButton) {
                    otherButton.setAttribute("aria-expanded", "false");
                }
            }
        });
    });
});

document.addEventListener("click", (event) => {
    if (event.target.closest(".has-submenu")) {
        return;
    }

    document.querySelectorAll(".has-submenu.open").forEach((item) => {
        item.classList.remove("open");
        const button = item.querySelector(".nav-trigger");
        if (button) {
            button.setAttribute("aria-expanded", "false");
        }
    });
});

const homePage = document.querySelector(".home-page");
if (homePage) {
    const currentTime = homePage.querySelector("#homeCurrentTime");
    const newsBody = homePage.querySelector("#homeNewsBody");
    const newsToggle = homePage.querySelector("#homeNewsToggle");
    const newsData = Array.isArray(window.homeNewsData) ? window.homeNewsData : [];
    const previewCount = 30;
    let isExpanded = false;

    const updateCurrentTime = () => {
        if (!currentTime) {
            return;
        }

        const now = new Date();
        const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
        const dateLabel = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 週${weekdays[now.getDay()]}`;
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        currentTime.textContent = `${dateLabel} ${hours}:${minutes}`;
        currentTime.dateTime = now.toISOString();
    };

    updateCurrentTime();
    setInterval(updateCurrentTime, 30000);

    const marqueeText = homePage.querySelector("#homeMarqueeText");
    const marqueeFallbackMessage = "歡迎來到愛蓁電信工作室 - 頻譜資訊網~";

    const loadMarqueeMessages = async () => {
        try {
            const response = await fetch(`marquee.txt?t=${Date.now()}`, { cache: "no-store" });
            if (!response.ok) {
                throw new Error("marquee.txt 無法讀取。");
            }

            const text = await response.text();
            const messages = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            return messages.length ? messages : [marqueeFallbackMessage];
        } catch (error) {
            console.warn("Marquee messages check failed", error);
            return [marqueeFallbackMessage];
        }
    };

    const playMarquee = async () => {
        if (!marqueeText) {
            return;
        }

        const windowElement = marqueeText.closest(".marquee-window");
        const messages = await loadMarqueeMessages();
        let index = 0;

        const runNextMessage = () => {
            const message = messages[index % messages.length];
            index += 1;
            marqueeText.textContent = message;

            requestAnimationFrame(() => {
                const windowWidth = windowElement?.clientWidth || 0;
                const textWidth = marqueeText.scrollWidth;
                const distance = windowWidth + textWidth;
                const duration = Math.max(4800, distance * 16);

                marqueeText.getAnimations().forEach((animation) => animation.cancel());
                const animation = marqueeText.animate([
                    { transform: `translateX(${windowWidth}px)` },
                    { transform: `translateX(${-textWidth}px)` },
                ], {
                    duration,
                    easing: "linear",
                    fill: "forwards",
                });

                animation.onfinish = runNextMessage;
                animation.oncancel = null;
            });
        };

        runNextMessage();
    };

    playMarquee();

    const detectorOperators = [
        { id: "cht", name: "中華電信", flagKey: "CHT_status" },
        { id: "fet", name: "遠傳電信", flagKey: "FET_status" },
        { id: "twm", name: "台灣大哥大", flagKey: "TWM_status" },
    ];
    const statusRefreshIntervalMs = 120000;
    const statusFlagUrls = [
        "https://raw.githubusercontent.com/AiZhen-93/Telecom-status/main/flags.txt",
        "../flags.txt",
        "flags.txt",
    ];
    const networkStatusUrls = [
        "https://raw.githubusercontent.com/AiZhen-93/Telecom-status/main/network-status.json",
        "../network-status.json",
        "network-status.json",
    ];
    const statusLabels = {
        green: "連線正常",
        yellow: "局部異常",
        red: "重大異常",
    };

    const setOperatorStatus = (operatorId, level, details = "", reportCount = undefined) => {
        const cell = homePage.querySelector(`[data-operator-status="${operatorId}"]`);
        if (!cell) {
            return;
        }

        const light = cell.querySelector(".status-light");
        const label = cell.querySelector(".status-text");
        const countLabel = cell.querySelector(".status-report-count");
        if (light) {
            light.className = `status-light status-${level}`;
        }
        if (label) {
            label.textContent = statusLabels[level] || statusLabels.green;
        }
        if (countLabel && reportCount !== undefined) {
            const hasNumericCount = Number.isFinite(reportCount);
            const hasTextCount = typeof reportCount === "string" && reportCount.trim();
            countLabel.textContent = hasNumericCount || hasTextCount ? `${reportCount}` : "--";
            countLabel.setAttribute("aria-label", hasNumericCount ? `最近5分鐘回報 ${reportCount}` : details || "回報數讀取中");
        }
        cell.title = details;
        cell.setAttribute("aria-label", details || label?.textContent || "");
    };

    const updateStatusReportCount = (operatorId, details = "", reportCount = null) => {
        const cell = homePage.querySelector(`[data-operator-status="${operatorId}"]`);
        if (!cell) {
            return;
        }

        const countLabel = cell.querySelector(".status-report-count");
        if (countLabel) {
            const hasNumericCount = Number.isFinite(reportCount);
            const hasTextCount = typeof reportCount === "string" && reportCount.trim();
            countLabel.textContent = hasNumericCount || hasTextCount ? `${reportCount}` : "--";
            countLabel.setAttribute("aria-label", hasNumericCount ? `最近5分鐘回報 ${reportCount}` : details || "回報數讀取中");
        }
    };

    const parseStatusFlags = (text) => text
        .split(/\r?\n/)
        .reduce((flags, line) => {
            const match = line.trim().match(/^([A-Za-z_]+)\s*[:=]\s*([0-2])\s*$/);
            if (match) {
                flags[match[1]] = Number(match[2]);
            }
            return flags;
        }, {});

    const fetchFirstAvailable = async (urls, options = {}) => {
        let lastError;

        for (const url of urls) {
            try {
                const response = await fetch(`${url}?t=${Date.now()}`, {
                    cache: "no-store",
                    ...options,
                });
                if (response.ok) {
                    return response;
                }
                lastError = new Error(`${url} 回應 ${response.status}`);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error("狀態檔案無法讀取。");
    };

    const fetchStatusFlags = async () => {
        try {
            const response = await fetchFirstAvailable(statusFlagUrls);
            return { flags: parseStatusFlags(await response.text()), readable: true };
        } catch (error) {
            console.warn("Status flags check failed", error);
            return { flags: {}, readable: false };
        }
    };

    const fetchNetworkStatus = async () => {
        try {
            const response = await fetchFirstAvailable(networkStatusUrls);
            return { data: await response.json(), readable: true };
        } catch (error) {
            console.warn("Network status check failed", error);
            return { data: {}, readable: false };
        }
    };

    const applyManualStatusFlag = (operator, flagValue) => {
        if (flagValue === 1) {
            setOperatorStatus(operator.id, "yellow", `${operator.name}: flags.txt 手動指定局部異常`);
            return true;
        }

        if (flagValue === 2) {
            setOperatorStatus(operator.id, "red", `${operator.name}: flags.txt 手動指定重大異常`);
            return true;
        }

        return false;
    };

    const normalizeStatusLevel = (level) => (
        ["green", "yellow", "red"].includes(level) ? level : "green"
    );

    const getNetworkStatusDetails = (operator, operatorStatus, networkStatusData) => {
        if (!networkStatusData) {
            return `${operator.name}: network-status.json 讀取失敗`;
        }

        if (!operatorStatus) {
            return `${operator.name}: network-status.json 沒有此業者資料`;
        }

        if (operatorStatus.error) {
            return `${operator.name}: ${operatorStatus.error}`;
        }

        return operatorStatus.message || `${operator.name}: Actions 狀態更新於 ${networkStatusData.updated || "未知時間"}`;
    };

    const checkNetworkStatuses = async () => {
        if (document.visibilityState === "hidden") {
            return;
        }

        const [statusFlagsResult, networkStatusResult] = await Promise.all([
            fetchStatusFlags(),
            fetchNetworkStatus(),
        ]);

        const statusFlags = statusFlagsResult.flags;
        const networkStatusData = networkStatusResult.data || {};

        detectorOperators.forEach((operator) => {
            if (!statusFlagsResult.readable) {
                setOperatorStatus(operator.id, "green", `${operator.name}: flags.txt 讀取失敗，請用 HTTP 伺服器開啟頁面`, "F!");
                return;
            }

            const operatorStatus = networkStatusData[operator.id];
            const details = getNetworkStatusDetails(operator, operatorStatus, networkStatusResult.readable ? networkStatusData : null);
            const reportCount = Number.isFinite(operatorStatus?.reports) ? operatorStatus.reports : null;
            const flagValue = statusFlags[operator.flagKey] ?? 0;

            if (applyManualStatusFlag(operator, flagValue)) {
                updateStatusReportCount(operator.id, details, reportCount);
                return;
            }

            setOperatorStatus(operator.id, normalizeStatusLevel(operatorStatus?.level), details, reportCount);
        });
    };

    checkNetworkStatuses();
    setInterval(checkNetworkStatuses, statusRefreshIntervalMs);
    document.addEventListener("visibilitychange", checkNetworkStatuses);

    const operatorColors = [
        { match: "中華", color: "#8fd0ff" },
        { match: "遠傳", color: "#ff8a8a" },
        { match: "台哥大/原台星", color: "#ffc166" },
        { match: "台灣大哥大", color: "#ffc166" },
        { match: "台哥大", color: "#ffc166" },
        { match: "原亞太", color: "#7ff0ad" },
        { match: "原台星", color: "#d8a6ff" },
    ];

    const badgeColors = {
        頻率改配: "rgba(82, 169, 255, 0.26)",
        參數調整: "rgba(39, 225, 187, 0.22)",
        核網關閉: "rgba(255, 90, 90, 0.24)",
        頻寬調整: "rgba(255, 200, 87, 0.24)",
        服務異動: "rgba(187, 124, 255, 0.24)",
    };

    const getOperatorColor = (operator = "") => {
        const matched = operatorColors.find((item) => operator.includes(item.match));
        return matched ? matched.color : "#f7fdff";
    };

    const getBadgeColor = (category = "") => (
        badgeColors[category] || "rgba(82, 169, 255, 0.18)"
    );

    const appendTextCell = (row, text) => {
        const cell = document.createElement("td");
        cell.textContent = text || "";
        row.append(cell);
        return cell;
    };

    const appendCategoryCell = (row, category) => {
        const cell = document.createElement("td");
        if (category) {
            const badge = document.createElement("span");
            badge.className = "news-badge";
            badge.style.setProperty("--badge-bg", getBadgeColor(category));
            badge.textContent = category;
            cell.append(badge);
        }
        row.append(cell);
    };

    const appendContentCell = (row, item) => {
        const cell = document.createElement("td");
        if (item.link) {
            const isLocalImageLink = /^pic\/.+\.(?:jpe?g|png)(?:$|[?#])/i.test(item.link);
            const link = document.createElement("a");
            link.className = "home-news-link";
            link.href = assetPath(item.link);
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = item.content || item.link;

            if (!isLocalImageLink) {
                const icon = document.createElement("span");
                icon.className = "external-link-icon";
                icon.setAttribute("aria-hidden", "true");
                link.append(icon);
            }
            cell.append(link);
        } else {
            cell.textContent = item.content || "";
        }
        row.append(cell);
    };

    const renderHomeNews = () => {
        const visibleItems = isExpanded ? newsData : newsData.slice(0, previewCount);
        newsBody.replaceChildren();

        visibleItems.forEach((item) => {
            const row = document.createElement("tr");
            row.style.setProperty("--operator-row-color", getOperatorColor(item.operator));

            appendTextCell(row, item.source);
            appendTextCell(row, item.date);
            appendCategoryCell(row, item.category);
            appendTextCell(row, item.operator);
            appendTextCell(row, item.area);
            appendTextCell(row, item.site);
            appendContentCell(row, item);

            newsBody.append(row);
        });

        if (newsToggle) {
            const shouldShowToggle = newsData.length > previewCount;
            newsToggle.hidden = !shouldShowToggle;
            newsToggle.setAttribute("aria-expanded", String(isExpanded));
            newsToggle.textContent = isExpanded ? "收合公告" : "展開全部公告";
        }
    };

    if (newsToggle) {
        newsToggle.addEventListener("click", () => {
            isExpanded = !isExpanded;
            renderHomeNews();
        });
    }

    renderHomeNews();

    const impactNumbers = homePage.querySelectorAll(".impact-number");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const numberFormatter = new Intl.NumberFormat("en-US");

    const animateImpactNumber = (element) => {
        const target = Number(element.dataset.target || 0);
        if (!target || element.dataset.animated === "true") {
            return;
        }

        element.dataset.animated = "true";

        if (reducedMotion) {
            element.textContent = numberFormatter.format(target);
            return;
        }

        const duration = 1500;
        const startTime = performance.now();

        const update = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - ((1 - progress) ** 3);
            element.textContent = numberFormatter.format(Math.round(target * eased));

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    };

    if (impactNumbers.length) {
        if ("IntersectionObserver" in window) {
            const impactObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        impactNumbers.forEach(animateImpactNumber);
                        observer.disconnect();
                    }
                });
            }, { threshold: 0.35 });

            impactObserver.observe(impactNumbers[0].closest(".impact-panel"));
        } else {
            impactNumbers.forEach(animateImpactNumber);
        }
    }
}

const projectVideosPage = document.querySelector(".project-videos-page");
if (projectVideosPage) {
    const list = projectVideosPage.querySelector("#projectVideoList");
    const videos = Array.isArray(window.projectVideosData) ? window.projectVideosData : [];

    const typeClasses = {
        軟體: "software",
        實測: "field-test",
        技術: "technology",
        彙報: "briefing",
    };

    const createTitle = (item) => {
        const title = document.createElement("h2");
        if (!item.url) {
            title.textContent = item.title || "";
            return title;
        }

        const link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.title || "";

        const icon = document.createElement("span");
        icon.className = "external-link-icon";
        icon.setAttribute("aria-hidden", "true");
        link.append(icon);

        title.append(link);
        return title;
    };

    const createCard = (item, index) => {
        const article = document.createElement("article");
        article.className = "project-video-card";

        const thumbWrap = document.createElement(item.url ? "a" : "div");
        thumbWrap.className = "project-video-thumb";
        if (item.url) {
            thumbWrap.href = item.url;
            thumbWrap.target = "_blank";
            thumbWrap.rel = "noopener noreferrer";
            thumbWrap.setAttribute("aria-label", `觀看影片：${item.title}`);
        }

        const image = document.createElement("img");
        image.src = assetPath(item.thumbnail || "pic/YT_icon.png");
        image.alt = `${item.title || `專題影片 ${index + 1}`} 縮圖`;
        image.loading = index < 4 ? "eager" : "lazy";
        thumbWrap.append(image);

        const content = document.createElement("div");
        content.className = "project-video-content";
        content.append(createTitle(item));

        const meta = document.createElement("div");
        meta.className = "project-video-meta";

        if (item.type) {
            const badge = document.createElement("span");
            badge.className = `project-video-badge ${typeClasses[item.type] || ""}`.trim();
            badge.textContent = item.type;
            meta.append(badge);
        }

        const date = document.createElement("time");
        date.textContent = item.date || "";
        meta.append(date);
        content.append(meta);

        const intro = document.createElement("p");
        intro.textContent = item.intro || "";
        content.append(intro);

        article.append(thumbWrap, content);
        return article;
    };

    if (list) {
        list.replaceChildren(...videos.map(createCard));
    }
}

const hsrProjectPage = document.querySelector(".hsr-project-page");
if (hsrProjectPage) {
    const source = window.hsrProjectData || {};
    const items = Array.isArray(source.items) ? source.items : [];
    const stations = source.stations || {};
    const northList = hsrProjectPage.querySelector("#hsrNorthList");
    const southList = hsrProjectPage.querySelector("#hsrSouthList");
    const sectionTargets = {
        north: {
            list: northList,
            toggle: hsrProjectPage.querySelector("#hsrNorthToggle"),
            expanded: false,
        },
        south: {
            list: southList,
            toggle: hsrProjectPage.querySelector("#hsrSouthToggle"),
            expanded: false,
        },
    };
    const previewCount = 10;

    const routeColors = {
        cht: "#52a9ff",
        fet: "#ff5f65",
        twm: "#ffc857",
        apt: "#48d676",
        tstar: "#bb7cff",
        multi: "#ffffff",
        unknown: "#edfaff",
    };

    const operatorLabels = {
        cht: "中華電信",
        fet: "遠傳電信",
        twm: "台灣大哥大",
        apt: "亞太電信",
        tstar: "台灣之星",
        multi: "多業者",
        unknown: "其他業者",
    };

    const createVideoTitle = (item) => {
        const title = document.createElement("h3");
        const link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.title || "";

        const icon = document.createElement("span");
        icon.className = "external-link-icon";
        icon.setAttribute("aria-hidden", "true");
        link.append(icon);

        title.append(link);
        return title;
    };

    const createRouteLine = (item) => {
        const sectionStations = stations[item.segment] || [];
        const startIndex = sectionStations.indexOf(item.start);
        const endIndex = sectionStations.indexOf(item.end);
        const low = Math.min(startIndex, endIndex);
        const high = Math.max(startIndex, endIndex);
        const divisor = Math.max(sectionStations.length - 1, 1);
        const isSinglePoint = startIndex === endIndex;
        const startPosition = isSinglePoint
            ? Math.max(startIndex - 0.5, 0)
            : low;
        const endPosition = isSinglePoint
            ? Math.min(startIndex + 0.5, divisor)
            : high;
        const startPercent = startPosition >= 0 ? (startPosition / divisor) * 100 : 0;
        const endPercent = endPosition >= 0 ? (endPosition / divisor) * 100 : 0;

        const route = document.createElement("div");
        route.className = `hsr-route hsr-route-${item.operatorKey || "unknown"}`;
        route.style.setProperty("--route-color", routeColors[item.operatorKey] || routeColors.unknown);
        route.style.setProperty("--route-start", `${startPercent}%`);
        route.style.setProperty("--route-end", `${endPercent}%`);

        const track = document.createElement("div");
        track.className = "hsr-route-track";
        const segment = document.createElement("div");
        segment.className = "hsr-route-segment";
        track.append(segment);
        route.append(track);

        const stationWrap = document.createElement("div");
        stationWrap.className = "hsr-route-stations";
        sectionStations.forEach((station, index) => {
            const stationNode = document.createElement("div");
            stationNode.className = "hsr-route-station";
            if (index >= low && index <= high) {
                stationNode.classList.add("is-active");
            }

            const dot = document.createElement("span");
            dot.className = "hsr-route-dot";
            const label = document.createElement("span");
            label.className = "hsr-route-label";
            label.textContent = station;
            stationNode.append(dot, label);
            stationWrap.append(stationNode);
        });
        route.append(stationWrap);
        return route;
    };

    const createHsrCard = (item, index) => {
        const article = document.createElement("article");
        article.className = "hsr-project-card";

        const thumb = document.createElement("a");
        thumb.className = "hsr-project-thumb";
        thumb.href = item.url;
        thumb.target = "_blank";
        thumb.rel = "noopener noreferrer";
        thumb.setAttribute("aria-label", `觀看影片：${item.title}`);

        const image = document.createElement("img");
        image.src = assetPath(item.thumbnail || "pic/YT_icon.png");
        image.alt = `${item.title || `高鐵測試 ${index + 1}`} 縮圖`;
        image.loading = index < 4 ? "eager" : "lazy";
        thumb.append(image);

        const body = document.createElement("div");
        body.className = "hsr-project-body";
        body.append(createVideoTitle(item));

        const meta = document.createElement("div");
        meta.className = "hsr-project-meta";

        const date = document.createElement("time");
        date.textContent = item.date || "";
        meta.append(date);

        const operator = document.createElement("span");
        operator.className = "hsr-project-operator";
        operator.textContent = operatorLabels[item.operatorKey] || item.operator || "";
        operator.style.setProperty("--route-color", routeColors[item.operatorKey] || routeColors.unknown);
        meta.append(operator);

        const routeText = document.createElement("span");
        routeText.textContent = item.start === item.end ? item.start : `${item.start}-${item.end}`;
        meta.append(routeText);
        body.append(meta, createRouteLine(item));

        article.append(thumb, body);
        return article;
    };

    const renderSection = (segment) => {
        const target = sectionTargets[segment];
        if (!target?.list) {
            return 0;
        }
        const sectionItems = items.filter((item) => item.segment === segment);
        const visibleItems = target.expanded ? sectionItems : sectionItems.slice(0, previewCount);
        target.list.replaceChildren(...visibleItems.map(createHsrCard));

        if (target.toggle) {
            const shouldShowToggle = sectionItems.length > previewCount;
            target.toggle.hidden = !shouldShowToggle;
            target.toggle.setAttribute("aria-expanded", String(target.expanded));
            target.toggle.textContent = target.expanded ? "收合" : "展開全部";
        }
        return sectionItems.length;
    };

    Object.entries(sectionTargets).forEach(([segment, target]) => {
        if (target.toggle) {
            target.toggle.addEventListener("click", () => {
                target.expanded = !target.expanded;
                renderSection(segment);
            });
        }
    });

    renderSection("north");
    renderSection("south");
}

const mergeZonePage = document.querySelector(".merge-zone-page");
if (mergeZonePage) {
    const data = window.mergeZoneData || {};
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const switchInputs = mergeZonePage.querySelectorAll('input[name="mergeZoneView"]');
    const sectionCards = mergeZonePage.querySelectorAll("[data-merge-section]");
    const targets = {
        "twm-tst": mergeZonePage.querySelector("#twmTstMergeTimeline"),
        "fet-gt": mergeZonePage.querySelector("#fetGtMergeTimeline"),
    };
    const overviewTargets = {
        "twm-tst": mergeZonePage.querySelector("#twmTstMergeOverview"),
        "fet-gt": mergeZonePage.querySelector("#fetGtMergeOverview"),
    };
    const safeTone = (tone = "") => (
        ["orange", "purple", "red", "green", "blue", "gray"].includes(tone) ? tone : "default"
    );
    const phaseId = (sectionKey, phaseCode) => `merge-${sectionKey}-${String(phaseCode || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const phaseStatusClass = (phase) => {
        const status = phase?.period?.status || "";
        if (status.includes("已完成")) {
            return "is-complete";
        }
        if (status.includes("進行") || status.includes("局部") || status.includes("未完成")) {
            return "is-active";
        }
        return "is-pending";
    };

    const appendMultilineText = (root, text) => {
        String(text || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line) => {
                const paragraph = document.createElement("p");
                paragraph.textContent = line;
                root.append(paragraph);
            });
    };

    const createBand = (band) => {
        const tone = safeTone(band?.tone);
        const chip = document.createElement("span");
        chip.className = `merge-band tone-${tone}`;
        if (band?.border) {
            chip.classList.add(`border-${safeTone(band.border)}`);
        }
        if (band?.strike) {
            chip.classList.add("is-struck");
        }
        chip.textContent = band?.text || "";
        return chip;
    };

    const createTower = (tower) => {
        const bandItems = Array.isArray(tower.bands) ? tower.bands.filter((band) => band?.text) : [];
        if (!bandItems.length) {
            return null;
        }

        const card = document.createElement("section");
        card.className = `merge-tower-card tower-${tower.key || "default"}`;

        const visual = document.createElement("div");
        visual.className = "merge-tower-visual";

        const image = document.createElement("img");
        image.src = assetPath(tower.image || "pic/profile.png");
        image.alt = tower.name || "";
        image.loading = "lazy";
        visual.append(image);

        const body = document.createElement("div");
        body.className = "merge-tower-body";

        const title = document.createElement("h4");
        title.textContent = tower.name || "";
        body.append(title);

        const bands = document.createElement("div");
        bands.className = "merge-band-list";
        bandItems.forEach((band) => bands.append(createBand(band)));
        body.append(bands);

        card.append(visual, body);
        return card;
    };

    const createNote = (titleText, contentText) => {
        const note = document.createElement("section");
        note.className = "merge-phase-note";

        const title = document.createElement("h4");
        title.textContent = titleText;
        note.append(title);

        if (contentText && contentText !== "-") {
            appendMultilineText(note, contentText);
        } else {
            const empty = document.createElement("p");
            empty.textContent = "-";
            note.append(empty);
        }
        return note;
    };

    const createVideos = (videos, headingText = "實測參考影片") => {
        const list = document.createElement("div");
        list.className = "merge-video-list";

        const title = document.createElement("h4");
        title.textContent = headingText;
        list.append(title);

        const items = Array.isArray(videos) ? videos : [];
        if (!items.length) {
            const empty = document.createElement("p");
            empty.className = "merge-video-empty";
            empty.textContent = "-";
            list.append(empty);
            return list;
        }

        const getYoutubeId = (url = "") => {
            const match = String(url).match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
            return match ? match[1] : "";
        };

        items.forEach((video) => {
            const link = document.createElement(video.url ? "a" : "div");
            link.className = "merge-video-card";
            if (video.url) {
                link.href = video.url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            }

            const thumbWrap = document.createElement("span");
            thumbWrap.className = "merge-video-thumb";

            const image = document.createElement("img");
            const youtubeId = getYoutubeId(video.url);
            image.src = assetPath(youtubeId ? `pic/merge-video-${youtubeId}.jpg` : "pic/YT_icon.png");
            image.alt = video.title || "實測參考影片";
            image.loading = "lazy";
            thumbWrap.append(image);

            const label = document.createElement("span");
            label.className = "merge-video-title";
            label.textContent = video.title || video.url || "";

            link.append(thumbWrap, label);
            list.append(link);
        });

        return list;
    };

    const createPhase = (phase, sectionKey) => {
        const item = document.createElement("article");
        item.className = "merge-phase-card";
        item.id = phaseId(sectionKey, phase.phase);

        const marker = document.createElement("div");
        marker.className = "merge-phase-marker";

        const code = document.createElement("strong");
        code.className = "merge-phase-code";
        code.textContent = phase.phase || "";
        marker.append(code);

        const period = document.createElement("div");
        period.className = "merge-phase-period";
        if (phase.period?.start || phase.period?.end) {
            const time = document.createElement("time");
            time.textContent = [phase.period.start, phase.period.end].filter(Boolean).join(" - ");
            period.append(time);
        }
        if (phase.period?.status) {
            const status = document.createElement("span");
            status.textContent = phase.period.status;
            period.append(status);
        }
        marker.append(period);

        const body = document.createElement("div");
        body.className = "merge-phase-body";

        const towers = document.createElement("div");
        towers.className = "merge-tower-grid";
        (Array.isArray(phase.towers) ? phase.towers : []).forEach((tower) => {
            const towerElement = createTower(tower);
            if (towerElement) {
                towers.append(towerElement);
            }
        });
        if (towers.children.length) {
            body.append(towers);
        }

        const notes = document.createElement("div");
        notes.className = "merge-phase-notes";
        notes.append(createNote("主要調整內容", phase.adjustment));
        notes.append(createNote("主要影響", phase.impact));
        body.append(notes);
        const videoHeading = phase.phase === "M0" ? "聽證會影片" : "實測參考影片";
        body.append(createVideos(phase.videos, videoHeading));

        item.append(marker, body);
        return item;
    };

    const createOverview = (section) => {
        const root = document.createElement("div");
        root.className = "merge-phase-overview-track";

        const phases = Array.isArray(section.phases) ? section.phases : [];
        phases.forEach((phase, index) => {
            const button = document.createElement("button");
            button.className = `merge-phase-overview-step ${phaseStatusClass(phase)}`;
            button.type = "button";
            button.setAttribute("aria-label", `前往 ${section.title || ""} ${phase.phase || ""} 階段`);
            button.addEventListener("click", () => {
                const target = document.getElementById(phaseId(section.key, phase.phase));
                if (target) {
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });

            const dot = document.createElement("span");
            dot.className = "merge-phase-overview-dot";
            dot.textContent = phase.phase || "";
            button.append(dot);

            if (index < phases.length - 1) {
                const arrow = document.createElement("span");
                arrow.className = "merge-phase-overview-arrow";
                arrow.textContent = ">>";
                button.append(arrow);
            }

            root.append(button);
        });

        return root;
    };

    sections.forEach((section) => {
        const target = targets[section.key];
        if (!target) {
            return;
        }
        const phases = Array.isArray(section.phases) ? section.phases : [];
        target.replaceChildren(...phases.map((phase) => createPhase(phase, section.key)));

        const overviewTarget = overviewTargets[section.key];
        if (overviewTarget) {
            overviewTarget.replaceChildren(createOverview(section));
        }
    });

    const setActiveMergeSection = (sectionKey) => {
        sectionCards.forEach((card) => {
            card.hidden = card.dataset.mergeSection !== sectionKey;
        });
    };

    switchInputs.forEach((input) => {
        input.addEventListener("change", () => {
            if (input.checked) {
                setActiveMergeSection(input.value);
            }
        });
    });

    const checkedInput = Array.from(switchInputs).find((input) => input.checked);
    if (checkedInput) {
        setActiveMergeSection(checkedInput.value);
    }
}

const taiwanMapCountyPaths = [

        { id: "keelung-city", name: "基隆市", region: "north", path: "M934.8 365l-0.3 11.9 0.2 3 3.7 3.9-0.4 2.5-2.5 1.8-4 1.5-5.1-0.6-10.6-4.4-3-2.2-3.7-3.4-2.8-3.5-1.7-3.5-2.9-3.7-0.6-2.9 3.2-2.2 7.2-3.1 4.4-2.9 1.4 0.9 2.4 2.7 3.9 1.4 11.2 2.8z" },
        { id: "taipei-city", name: "台北市", region: "north", path: "M897.4 413.2l-4.2 1.7-5.8-0.1-4.8-1-3.7-3.3-3.8-4.3-5.8-4.6-3.9-6.7 1.5-7.4-1.2-6.3-5.7-5.5-3.8-4.2 1.6-3 1.8-2.4 2.1-4.6 3.6-4 10.9-6.4 2.9-2.5 4-2 3.8 1.2 2.1 2.2-0.5 3.6 0.4 3.5 3.2 6.8 2.5 10 3.9 3.5 1.6 4.4-1.6 6.6 0.1 5.1 4.6 2.6 3.8 3.2-2 4.3-7.6 9.6z" },
        { id: "new-taipei-city", name: "新北市", region: "north", path: "M915.9 357.2l-4.4 2.9-7.2 3.1-3.2 2.2 0.6 2.9 2.9 3.7 1.7 3.5 2.8 3.5 3.7 3.4 3 2.2 10.6 4.4 5.1 0.6 4-1.5 2.5-1.8 0.4-2.5-3.7-3.9-0.2-3 0.3-11.9 34.6 8.4 3.2 2-1.6 3.7-0.4 2.9 0.7 5.2 2.4 8.7 2.6 4.1 2.2 0.9 7-1 3.6 0.4 4.2 1.1 3.7 1.9 2 2.5-8.7 4.3-0.8-1.1-3.3-1.9-5.9 1.3-8.4 4.4-3.7 2.5-11.2 2.3-1.4 2.9 2.5 3.6-1.6 3.8-4.6 2.9-3.5 1.2-3.7 2-3.3 4.1-3.1 5-5 3.6-6.2 1.9-13.5 8.1-13 5.3-3.8 2.3-4.7 4-2 4.9 0.2 4.2 1 3.2 0.4 2-3.9 2.8-6.6 3.2-5 3.5-3.8 3.3-4.9 1.8-5.7 1.6-2.5-5.4-8.9-8.5-1.4-5.6-0.8-5.2 3.1-3.7 1.5-5.3-8.5-12.3-5-2-7.4 0.4-5.1-2.9 1.3-6.7-1-5.1-5.4-5.1-1-5.1 1-5.8-0.2-6.2 3.7-4 13.1-3.9 3.3-3.4 1-4.2-0.5-4.1-5.1-7.5-4.2-2.2-4.1-1-3.2-2.8-4.7-3.1-6.3-3-4.2-4.6 11.2-2.1 4.8-1.8 6.1-5.2 1.9-0.9 2.2-0.4 3.1 0 3.5 1.1 1.9 2.7 1.2 2.7 1.5 1.6 3.5-1.4-3.6-5.7-5.8-5.9-3.1-1.9 0.9-2.7 1.8-1.5 1.9-0.9 0.8-1 2.1-5.1 3.2-5.9 6.6-5.9 9.6-4.9 11-2.5 10.8 1.2 4.5 3.4 10 14.2 3.6 7.4 1.2-0.5 2.7-0.7 3-0.4 2.2 0.6-0.1 0.9-1.1 1.3-1 1.8 0.1 2.2 1.1 1.2 2.3 1.7z m-18.5 56l7.6-9.6 2-4.3-3.8-3.2-4.6-2.6-0.1-5.1 1.6-6.6-1.6-4.4-3.9-3.5-2.5-10-3.2-6.8-0.4-3.5 0.5-3.6-2.1-2.2-3.8-1.2-4 2-2.9 2.5-10.9 6.4-3.6 4-2.1 4.6-1.8 2.4-1.6 3 3.8 4.2 5.7 5.5 1.2 6.3-1.5 7.4 3.9 6.7 5.8 4.6 3.8 4.3 3.7 3.3 4.8 1 5.8 0.1 4.2-1.7z" },
        { id: "taoyuan-city", name: "桃園市", region: "taoyuanHsinchu", path: "M861.8 498.8l-3.1 0.9-5.4 3.9 3.1 12.4-2.2 3.8-3.4 1.3-3.3-0.6-3.9 1.6-0.5 1.5-4.8-2.2-7.3-4.1-4-2.9-5.5-0.9-6.2-3.8-5.2-3.9-0.5-4.3 4.6-6.5 1.9-7.8-1.6-7.3-0.4-5-3.4-2.6-4.3-2.2-2.6-4.5-3.4-3.5-3.9 0.3-3.8-0.7-3.1-3.1-4.2-3.1-6.5-2.1-3.5-3.7 1.1-5.8-3.6-4.2-6.8-2.2-4.1-2-4.3-1.2-5-2-4-8.7-4.6-3.1-13.7 1-3.1-1.1 8.9-14.2 6.9-8.3 7.2-6.1 18.4-6.1 4.3-2.7 3.7-3.2 4.5-2.5 9-3.2 20.1-3.6 4.2 4.6 6.3 3 4.7 3.1 3.2 2.8 4.1 1 4.2 2.2 5.1 7.5 0.5 4.1-1 4.2-3.3 3.4-13.1 3.9-3.7 4 0.2 6.2-1 5.8 1 5.1 5.4 5.1 1 5.1-1.3 6.7 5.1 2.9 7.4-0.4 5 2 8.5 12.3-1.5 5.3-3.1 3.7 0.8 5.2 1.4 5.6 8.9 8.5 2.5 5.4z" },
        { id: "hsinchu-county", name: "新竹縣", region: "taoyuanHsinchu", path: "M843.1 523.6l-2.3 6.5-1.4 4.7 0.6 4.4-3.8 5.8-14 14.2-4.3 10.5-2.8-0.8-10.6 1-0.8 0.6-0.6-4.9-4.6-7.8-3.3-3.3-1.3-4.4-5-4-12.5 3.2-4.8-0.5-6.8 0.5-7.7 2.1-4.1-1 0.9-5.1 1.3-4.6-1-4-1-2.9 1-3.1 0.8-3.5 0.3-3.9-0.7-5.2-3.9-3.4-12.1-5.7-6-4.5-3.9-4.4-4.4-11.1 2.4-3.1 2.3-5.6 3.4-4.3 5.9-2.4 5.1-0.9 2.4-1.4 1-3.6-1.9-3.7-3.8-3.9-5.4-2.8-15.1-4.8-8.3-3.6 1.5-2.3 0.6-3.9 0.9-2.9 2-2.9 2.7-2.1 2.5-0.9-0.2-1.2 0.7-2.9 2.2-6.1 2.1-3.3 3.1 1.1 13.7-1 4.6 3.1 4 8.7 5 2 4.3 1.2 4.1 2 6.8 2.2 3.6 4.2-1.1 5.8 3.5 3.7 6.5 2.1 4.2 3.1 3.1 3.1 3.8 0.7 3.9-0.3 3.4 3.5 2.6 4.5 4.3 2.2 3.4 2.6 0.4 5 1.6 7.3-1.9 7.8-4.6 6.5 0.5 4.3 5.2 3.9 6.2 3.8 5.5 0.9 4 2.9 7.3 4.1 4.8 2.2z" },
        { id: "hsinchu-city", name: "新竹市", region: "taoyuanHsinchu", path: "M724.3 489l-0.2 0.2-4.6 1.1-4.4-1.7-2.7-3.8-4.3-2.6-6.9-2.7 1.2-4.1 5.5-11.4 2.2-3 0.7-1.5 0-1.7-0.7-1.9-1.1-2.2 1.5-3 1.8-1.8 8.3 3.6 15.1 4.8 5.4 2.8 3.8 3.9 1.9 3.7-1 3.6-2.4 1.4-5.1 0.9-5.9 2.4-3.4 4.3-2.3 5.6-2.4 3.1z" },
        { id: "miaoli-county", name: "苗栗縣", region: "miaoli", path: "M724.3 489l4.4 11.1 3.9 4.4 6 4.5 12.1 5.7 3.9 3.4 0.7 5.2-0.3 3.9-0.8 3.5-1 3.1 1 2.9 1 4-1.3 4.6-0.9 5.1 4.1 1 7.7-2.1 6.8-0.5 4.8 0.5 12.5-3.2 5 4 1.3 4.4 3.3 3.3 4.6 7.8 0.6 4.9-3.7 2.6-1.8 5.6-4.9 2-5.3-0.1-4.2 3-4.6 4.4-5.9 3.2-11.6 9.2-6.8 2.9-8.9 4.7-5.4-2.1-5-5.6-6-2.4-9.9-0.8-5.5 3.3-0.9 7.4-5.2 2.8-12.1 0.7-11.6-6.7-6.6-1.2-7.3-3.6-15.1-11.1-6.3-5.5-4.7-5-9.2-14.3 7.2-8.1 1.9-4 0.9-6.6 2.2-5.6 5.9-10.4 1.6-6.3 1.5-2.7 6.8-2 1.9-2.1 1.1-2.6 1.4-2.5 4.2-4.3 4.6-3.4 5.6-1.5 7.1 1.3-0.9-5.4 2.7-3.7 3.7-3.8 1.9-5.7 0.8-1.9 3.6-1.8 0.3-1.3 6.9 2.7 4.3 2.6 2.7 3.8 4.4 1.7 4.6-1.1 0.2-0.2z" },
        { id: "taichung-city", name: "台中市", region: "taichung", path: "M803.7 570.5l0.8-0.6 10.6-1 2.8 0.8 3.6 1-0.6 5.5 1.4 3.8 4.9 1 4.4 2.6 3.7 2.5 4-0.6 4.7-2.3 4.9 0 5.9 4.7-4.7 4.9-0.4 4.2-2.4 6.2-7.5 4.7-3 5-1.3 5.1-3.1 3.8-3.4 1.7-1.2 2.1-2.8 2-13.4-1.3-4.7-1-4.6 0.3-11.1 4.4-6.3 1-6.2 0.2-8.8 4.7-4.4 0.8-5.1 2.9-7.9 7.6-5 1.9-6.6-0.1-4.7 3.9-2.6 5.5-3.5 0.9-8.9-6.7-3 1.9-5.8 7.7-6 0.2-10.1-1.4-6.4 3-3.7 8.5-7.6 14.4-5 4.8-4.2 0.6-17.9-2.5-4.3-0.2 0-1.4-5.4-3.5-4.3-0.8-1.2-3.3-0.1-4-2-4-3.2-5-4.3-3.6-11.9-3.5-4.5-5.4-1-7.6-2.7-6.3-4-3.5-5.8-1.9 0.6-0.8 0.8-3.3 3.3-2.7 2.2-6.5 2.7-12.3 9.3-16.1 2.8-9.9 3.4-5.5 13.3-14.8 9.2 14.3 4.7 5 6.3 5.5 15.1 11.1 7.3 3.6 6.6 1.2 11.6 6.7 12.1-0.7 5.2-2.8 0.9-7.4 5.5-3.3 9.9 0.8 6 2.4 5 5.6 5.4 2.1 8.9-4.7 6.8-2.9 11.6-9.2 5.9-3.2 4.6-4.4 4.2-3 5.3 0.1 4.9-2 1.8-5.6 3.7-2.6z" },
        { id: "changhua-county", name: "彰化縣", region: "changhuaNantou", path: "M647.2 689.6l0.1 3.6-4.3 1.6-1.2 2.9 0.5 4-2 4.6-1.6 5.4-0.1 5.7-1.2 6.6-0.9 13.4 2.1 6.3 3.6 3.3 3.9 1.4 5.6 2.9-1 3.5-3.8 1.5-2.5 2.3-2.4 1.6-1 0.7-12-2.4-5.8 0.1-12.2-6-19.7-2.3-11.6-4.4-6.6-1.8-7.6-0.4-22 2.6-7.6-4.4 0.8-1.4 1.6-7.1 1.2-3 7.1-6.8 2-2.8 2.7-7.8 4.2-7.7 5.7-16.1 2.7-4.7 3-3 2.5-1.7 2.2-1.1 1.6-1.4 0.6-3 1.2-2.8 5.1-4 1.2-3 0.6-10.1 0.9-2.8 2.7-2.6 11.3-13.2 5.8 1.9 4 3.5 2.7 6.3 1 7.6 4.5 5.4 11.9 3.5 4.3 3.6 3.2 5 2 4 0.1 4 1.2 3.3 4.3 0.8 5.4 3.5 0 1.4z" },
        { id: "nantou-county", name: "南投縣", region: "changhuaNantou", path: "M825 627.6l1.4 6.2 0.2 3.7-5.2 2.4-6.6 2.2-3.7 2.9 0.2 9.9 2.9 3.1 5.2 3.4 1.5 4.5-0.3 3.9-8 10.4-5.1 10.7-2.3 7.6 2 3.3 1.8 4.5-0.6 7.6-1.6 9.9-3 8.8-3.9 8.5-2.5 7-0.2 3.7-5.7 9.4 2.1 4 3.2 4.1 1.2 5.4 0.9 7.2-1.2 8.4-3.2 12.6-1.6 5.1-4.5 3.1-7.6 2.8-4 5.2-1.3 8.5-5.3 4.7-7.4 0.3-7.4 1.6-5.2 3.9-1.5 4-1.5 2.7 1.7 6.2-3.1 2.8-6 3.5-0.7-2-4.2-5.9-5.8-2.2-4.3-1-0.9-0.2-25.6-0.2-7.6-1.4-1.1-3.8-0.4-5.9-2.7-6.5-1.2-4.8 3-5.1 0.3-5.3-5.1-2.8-4.1-1.2-6.8-2.6-6.1-0.7-2.6-3.5-8.2 0.9-6.8 2-5.8-2.5-4-4.7 0.9-5.7 1.9-5.2-1-7.7 1-7.2 2-4.7-1.9-7.2 2.4-1.6 2.5-2.3 3.8-1.5 1-3.5-5.6-2.9-3.9-1.4-3.6-3.3-2.1-6.3 0.9-13.4 1.2-6.6 0.1-5.7 1.6-5.4 2-4.6-0.5-4 1.2-2.9 4.3-1.6-0.1-3.6 4.3 0.2 17.9 2.5 4.2-0.6 5-4.8 7.6-14.4 3.7-8.5 6.4-3 10.1 1.4 6-0.2 5.8-7.7 3-1.9 8.9 6.7 3.5-0.9 2.6-5.5 4.7-3.9 6.6 0.1 5-1.9 7.9-7.6 5.1-2.9 4.4-0.8 8.8-4.7 6.2-0.2 6.3-1 11.1-4.4 4.6-0.3 4.7 1 13.4 1.3z" },
        { id: "yunlin-county", name: "雲林縣", region: "yunjianan", path: "M642 760.2l1.9 7.2-2 4.7-1 7.2 1 7.7-1.9 5.2-0.9 5.7 4 4.7 5.8 2.5 6.8-2 8.2-0.9 2.6 3.5-0.5 0-0.3 5 0 3.4-4 1.3-11.7 2.4-6.3 0.6-2.4-3.9-4.7-3.4-8.3 2.4-3.7 0.5-12.6-4.6-5-5.9-5.3-4.6-6.9 0.4-12.6 2.3-7.2 2-16.3 9.4-3.8 3.8-4.4 2.4-7 5.7-5.3 0.8-2.1 3-1.7 4.9-3.9 3.2-6.1-0.1-8.3-4.7-11.6 1.4 4.6-5.2-0.2-16.4 0.7-12.3 2.8-9.8 4.3-7.7 1.3-10 2.3-8.8 1.3-3 6.1-8.1 1.1-2.8 0.7-1.5 5.6-4.3 0.8-1.6 7.6 4.4 22-2.6 7.6 0.4 6.6 1.8 11.6 4.4 19.7 2.3 12.2 6 5.8-0.1 12 2.4 1-0.7z" },
        { id: "chiayi-county", name: "嘉義縣", region: "yunjianan", path: "M499.6 893.2l-1.8 1.4-0.4-1.1 2.4-3.1 0.9-2.4 1.1-1.5 0.6 0.5 0.1 1.1-1.4 2-1.5 3.1z m2.2-12.6l-0.7-0.7 2-3.8 0.9-0.4-0.5 1.9-1.7 3z m4.9-9l-0.1-4.4 0.5 0.4 0.1 2.9-0.5 1.1z m1.4-9.7l-0.8 1.6-0.5-2 1.3 0.4z m-1.3-6.1l-0.5 1.3-1.3-2.1 1.8 0.8z m-29.8 1l-3.2 1.6 3.8-5.4 13.9-14.1 10.6-13.5 2.5-0.8-9 14.7-4.5 4.5-2.9 3.5-3.8 3.8-3 2.1-4.4 3.6z m189.5-51.1l6.1 0.7 6.8 2.6 4.1 1.2 5.1 2.8-0.3 5.3-3 5.1 1.2 4.8 2.7 6.5 0.4 5.9 1.1 3.8 7.6 1.4 25.6 0.2 0.9 0.2-18.5 9.4-8.5 6.8-3.6 6.8-4.2 5-7.7 4.3-7.9 6.1-4.5 5.4-12.3 7.3-5.8 0.6-6.9-0.7-3.6 3.5-0.1 5 1.4 4.5 1 6.7-8.4-1-3.7-1.1-5 0.6-5.3 2.4-3.8 0-4.5-3.5-1.6-4.6 1.8-14.2-1-7.5-9.9-10.1-1.7-5.1-2.1-4.2-4-2.4-7.2-2.4-8.5 0.5-15.2 2.8-7.8 3.5-6.1 4.6-4.7 4.8-6.6 5.1-5.8 3.6-2.5 4.9-6.2 2.8-7.2-1.8-8.9-1.3-5.2-2 3.8-0.3 3.3-1.4 1.4 0.5-0.9-3.2-2.2 1.6-1.8-0.5-2.5-0.1 0-3.3 2.4-5.6 3.7-0.3 5.4 0.1-3.7-10.5-4.1-8 1.9-3.7 0-1.9-3.1-1.5 0.4-1.8 1.8-2 0.9-2.6 4-5.2-8.5 0.5-0.2-8.7 11.6-1.4 8.3 4.7 6.1 0.1 3.9-3.2 1.7-4.9 2.1-3 5.3-0.8 7-5.7 4.4-2.4 3.8-3.8 16.3-9.4 7.2-2 12.6-2.3 6.9-0.4 5.3 4.6 5 5.9 12.6 4.6 3.7-0.5 8.3-2.4 4.7 3.4 2.4 3.9 6.3-0.6 11.7-2.4 4-1.3 0-3.4 0.3-5 0.5 0z m-92.7 30.8l-3.8 4.1 0.9 5.6 6.1 2.4 7 4.5 7.3 1.7 6.8-2.7 4.5-0.6 3-2.2-2.5-6.8-2.5-4-4.1-2.2-5.6-2.1-7.8 0.7-9.3 1.6z" },
        { id: "chiayi-city", name: "嘉義市", region: "yunjianan", path: "M573.8 836.5l9.3-1.6 7.8-0.7 5.6 2.1 4.1 2.2 2.5 4 2.5 6.8-3 2.2-4.5 0.6-6.8 2.7-7.3-1.7-7-4.5-6.1-2.4-0.9-5.6 3.8-4.1z" },
        { id: "tainan-city", name: "台南市", region: "yunjianan", path: "M483.8 968.3l-0.6 1.2-2.3-2-1.7-4.2 0.3-1.3 0.7 0 0.9 1.2 0.7 1.9 2.1 2.2-0.1 1z m0.5-27.6l-2.9 6.8 3.9-13.3 0.6 0.1-1.6 6.4z m3.5-12.8l3.5-9.9 0.5-0.1 0.2 1.9-4.2 8.1z m6.3-22.5l-0.4 2.4 0.6-10.6 0.5 0.2-0.7 8z m149.5 11.5l-2.3 6.6-10.4 15.1-10 17-6.5 8.4-7.4 7.2-6.5 5.4-6.1 6.4-5.3 7.1-3 5.2-2.4 5.5-6.3 4.4-6.5 2.6-3.5 2.6-4.2 1.5-8.4-1-8.2 0.9-15.7-2.2-4.8-2.5-3.9-8.6-0.2-0.5-6.1 3.7-1-6.3-1.8-3.6-3.9-3.9 4.7-3.4 2.7-6.1-1.1-5.2-6.3-0.9-1.2 1.8-1.1 3.4-1.8 2.7-3.3-0.1-1.3-2.3 0.5-7-0.8-2.4-4.1-1.8-2.3 2.1-1.8 2.9-2.8 0.7-2.9-2.5-0.7-3.5 0.7-3.4 1.1-2.3 3-1.6 3.7-0.5 3.1-1 1-3-1.4-1.5-9.4-2.4 0-1.9 7.9-0.1-0.8-2.6-4.3-3.7-2.8-3.2 0.7-4 2.5-1.5 2.7-0.9 1.4-2.5-0.8-3.9-1.4-3.2 0.9-3 1.4-3.7 2.3-2.6-0.5-2.3 0.5-2.3 3.3-9 1.6-1.7 2.6-0.6-3.7-2.5 1.6-4.1 5.2 2 8.9 1.3 7.2 1.8 6.2-2.8 2.5-4.9 5.8-3.6 6.6-5.1 4.7-4.8 6.1-4.6 7.8-3.5 15.2-2.8 8.5-0.5 7.2 2.4 4 2.4 2.1 4.2 1.7 5.1 9.9 10.1 1 7.5-1.8 14.2 1.6 4.6 4.5 3.5 3.8 0 5.3-2.4 5-0.6 3.7 1.1 8.4 1z" },
        { id: "kaohsiung-city", name: "高雄市", region: "kaoping", path: "M739.8 857.3l1.9 5.8-3 5-5.6 2.4-1.4 3.2 1 4 5.6 3.6 6.3 5.2 2.8 7.6 0.3 2.5-15.6 3.8-6.4 4.1-4 3.9-7.8 5.1-0.9 5.7 2.3 6-2.7 4.9-7.4 4-0.8 6.9 2.1 9.9-3 13.2-0.1 11.2-4.3 5.9-8.5 7.2-2.3 9.8 1.3 8.1 3 4.6 6.2 6.4 1.2 4.9-3.9 0.5-5.2-0.9-4.3 0.2-8.5 6.7-5.9-5.5-7.6-8.9-7.2 1.8-6.6 5.9-13.1-6.6-9.4 4.5-6.4 7.1-8 2.8-17.8-1.1-1.7 4.9-1.3 7.2-2.6 7.9 0.5 7-0.1 9.5-5.7 21.2-0.1 7.1 2.7 7.5 0.4 8.2-8.1 20.5-2.6-1.1-1.6 0.1-1.8 0.7-2.2 0-13-10.2-12.1-17.1 12.7 15.4-1.5-7.4-3.8-7.2-5.3-6-9-8.4-3.5-4.2-1.6-4.8 2.2-4.6 1.1-4.1-1.5-5.8-2.7-5.6-4.9-7.7-4.6-10.2-1-4.5 0.1-3 1.5-3.6 0.3-2.4-0.5-1.2-2.7-2.3-0.5-2.3-2.9-4.9-0.7-2-2.1-13.6 6.1-3.7 0.2 0.5 3.9 8.6 4.8 2.5 15.7 2.2 8.2-0.9 8.4 1 4.2-1.5 3.5-2.6 6.5-2.6 6.3-4.4 2.4-5.5 3-5.2 5.3-7.1 6.1-6.4 6.5-5.4 7.4-7.2 6.5-8.4 10-17 10.4-15.1 2.3-6.6-1-6.7-1.4-4.5 0.1-5 3.6-3.5 6.9 0.7 5.8-0.6 12.3-7.3 4.5-5.4 7.9-6.1 7.7-4.3 4.2-5 3.6-6.8 8.5-6.8 18.5-9.4 4.3 1 5.8 2.2 4.2 5.9 0.7 2z" },
        { id: "pingtung-county", name: "屏東縣", region: "kaoping", path: "M569.4 1166l2 2.9-0.3 1-2.7 1.8-5 4.3-0.9-3.3 1.4-2.7 2.8-3.6 2 0 0.7-0.4z m126.7-143.3l3.5 6.6 0.7 4.9 5.4 1.3 5.5 3.6-2.8 13.8-0.1 5.2-2 5-9.8 4.1-4.8 2.7-7.6 1.6-5.4 4.5-2.4 6.6-3.7 6.6-3 7.5-0.8 14.7 1.2 6.5 2 6.1 1.1 7.1 0 5.4 2.6 5 4.6 5.6-2.5 3.8-5.3 3.2-2.1 3.9-0.5 4.5 2.7 3.9 3.4 1.7 3.1 4.4-0.1 5.7 0.6 6.1 3.2 5.9 4.6 4.9 10.2 4.7 4.5-0.3 0.9 51.6-1.6 7.3-2.5 6-3.4 2.5-4 3.7 0.1 8.3 1.5 9.2-0.4 5.9-4.5-6.8-6.8-5.2-7.8-3.5-8-1.9-0.3 6.6-2.3 2.3-3.4-0.8-3.7-3.1-0.2-2.4 1.3-7-5.5-9.2-0.5-2.4 0.1-2.1 0.4-3.2 0-10.8 0.5-3.1 2.5-3.6 0.5-3-19.9-51.6-1.6-2.9-5.5-6.8-4.4-9.9-2-2.8-8.2-6.5-5.4-3-0.9-3.7-0.7-1.3-4.4-2.9-10-4.8-4.5-3.1-4.8-4.2-2.6-1.6 8.1-20.5-0.4-8.2-2.7-7.5 0.1-7.1 5.7-21.2 0.1-9.5-0.5-7 2.6-7.9 1.3-7.2 1.7-4.9 17.8 1.1 8-2.8 6.4-7.1 9.4-4.5 13.1 6.6 6.6-5.9 7.2-1.8 7.6 8.9 5.9 5.5 8.5-6.7 4.3-0.2 5.2 0.9z" },
        { id: "yilan-county", name: "宜蘭縣", region: "east", path: "M982.4 448.9l2.1 0.5 1.6 2.2-0.7 2.3-3.8-0.1-1.4-0.8-1.7-2.7 0.9 0.3 3-1.7z m-47 152.6l-1.1 0-11.1-1.7-18.5-11.1-3.8 0.9-2.4 6-4.9 4.5-6.5 0-8.3-3.2-15-3.8-6.5-3.1-2.5-2.1-5.9-4.7-4.9 0-4.7 2.3-4 0.6-3.7-2.5-4.4-2.6-4.9-1-1.4-3.8 0.6-5.5-3.6-1 4.3-10.5 14-14.2 3.8-5.8-0.6-4.4 1.4-4.7 2.3-6.5 0.5-1.5 3.9-1.6 3.3 0.6 3.4-1.3 2.2-3.8-3.1-12.4 5.4-3.9 3.1-0.9 5.7-1.6 4.9-1.8 3.8-3.3 5-3.5 6.6-3.2 3.9-2.8-0.4-2-1-3.2-0.2-4.2 2-4.9 4.7-4 3.8-2.3 13-5.3 13.5-8.1 6.2-1.9 5-3.6 3.1-5 3.3-4.1 3.7-2 3.5-1.2 4.6-2.9 1.6-3.8-2.5-3.6 1.4-2.9 11.2-2.3 3.7-2.5 8.4-4.4 5.9-1.3 3.3 1.9 0.8 1.1-12 6-5.5 4.7-18.7 22.8-2.9 4.8-2.3 6.8-1.6 7.7-0.5 7.6 0.3 7.4 3.3 15.5-0.2 4-1.5 3.9 0.2 8.1 3.5 6.3 6.5 4 7.6 1.4 0 1.8-3.2-0.3-3.1 0.3-2.6 0.8-1.9 1.4 2.7 5 1.3 6.5-0.8 5.6-6 3.4-0.4 2.5 0.7 3 1.7 2.7 0.6 2.8-2.5 2.4-6.2 3.6-7 8-0.3 3.2 0.5 7-1.2 2.6-1.3 2.3-0.8 3.2-0.5 6.4-0.6 1.6-1 1.3-0.5 1.4 1.3 1.9z" },
        { id: "hualien-county", name: "花蓮縣", region: "east", path: "M935.4 601.5l0.6 0.8 1.6 2.9 0.2 1.1-1.4 2.4-5.8 5.7-6.2 8.6-4.7 3.7-1.4 2 0.7 2.1-0.9 1.5-6.6 5.1-2.5 2.4-2.8 6-2.9 12.2-7.4 10.9-1.5 4.4 0.2 4.7 1.8 5.2 1.5 2.3 1.3 1 0.8 1.4 0.1 3.2-1.1 3.6-3.7 5.8-0.7 3.5-0.4 6.4-3.2 16.3-6.4 17-8 40.1-4.8 9.8-11 64.1-3.5-1-10.8 5.2-3.9 5.4 1.7 6.9 0.6 6.9-3.6 6.9-3.4 5.2-2.7 6.6-2.4 8.4-3.7 7.7-4.8 13.2-3.1 6.1 0.1 6.7-0.9 6.2-6.5 3.7-8.2-1.1-11.7-9.7-9.2-16-5.7-1.5-6.3-0.9-5-4.8-6.1-2.9-7.8-2.8-5-8.1-1.2-7.4-0.3-2.5-2.8-7.6-6.3-5.2-5.6-3.6-1-4 1.4-3.2 5.6-2.4 3-5-1.9-5.8 6-3.5 3.1-2.8-1.7-6.2 1.5-2.7 1.5-4 5.2-3.9 7.4-1.6 7.4-0.3 5.3-4.7 1.3-8.5 4-5.2 7.6-2.8 4.5-3.1 1.6-5.1 3.2-12.6 1.2-8.4-0.9-7.2-1.2-5.4-3.2-4.1-2.1-4 5.7-9.4 0.2-3.7 2.5-7 3.9-8.5 3-8.8 1.6-9.9 0.6-7.6-1.8-4.5-2-3.3 2.3-7.6 5.1-10.7 8-10.4 0.3-3.9-1.5-4.5-5.2-3.4-2.9-3.1-0.2-9.9 3.7-2.9 6.6-2.2 5.2-2.4-0.2-3.7-1.4-6.2 2.8-2 1.2-2.1 3.4-1.7 3.1-3.8 1.3-5.1 3-5 7.5-4.7 2.4-6.2 0.4-4.2 4.7-4.9 2.5 2.1 6.5 3.1 15 3.8 8.3 3.2 6.5 0 4.9-4.5 2.4-6 3.8-0.9 18.5 11.1 11.1 1.7 1.1 0z" },
        { id: "taitung-county", name: "台東縣", region: "east", path: "M889.2 1263l-5.5 1.7-7.3-2.9-6.8-4.8-3.9-3.7 1.2-2.7-0.1-2.5-1-2.4-1.7-2.1 19.5 0 0 1.8-1.3 3.5-0.4 2.9 0.9 2.5 4.7 3.5 2 2.5-0.3 2.7z m-24-177.6l-0.1 1.1-3.4-0.4-0.4-0.6-2.7-1-2.8-4.9-1.4-4.3 0.6-0.6 10-0.7 1.1 0.6 0.8 2-0.8 3.9-0.9 1.6-0.4 1.7 0.4 1.6z m-163.1 114.1l-4.5 0.3-10.2-4.7-4.6-4.9-3.2-5.9-0.6-6.1 0.1-5.7-3.1-4.4-3.4-1.7-2.7-3.9 0.5-4.5 2.1-3.9 5.3-3.2 2.5-3.8-4.6-5.6-2.6-5 0-5.4-1.1-7.1-2-6.1-1.2-6.5 0.8-14.7 3-7.5 3.7-6.6 2.4-6.6 5.4-4.5 7.6-1.6 4.8-2.7 9.8-4.1 2-5 0.1-5.2 2.8-13.8-5.5-3.6-5.4-1.3-0.7-4.9-3.5-6.6 3.9-0.5-1.2-4.9-6.2-6.4-3-4.6-1.3-8.1 2.3-9.8 8.5-7.2 4.3-5.9 0.1-11.2 3-13.2-2.1-9.9 0.8-6.9 7.4-4 2.7-4.9-2.3-6 0.9-5.7 7.8-5.1 4-3.9 6.4-4.1 15.6-3.8 1.2 7.4 5 8.1 7.8 2.8 6.1 2.9 5 4.8 6.3 0.9 5.7 1.5 9.2 16 11.7 9.7 8.2 1.1 6.5-3.7 0.9-6.2-0.1-6.7 3.1-6.1 4.8-13.2 3.7-7.7 2.4-8.4 2.7-6.6 3.4-5.2 3.6-6.9-0.6-6.9-1.7-6.9 3.9-5.4 10.8-5.2 3.5 1-4.6 26.4-2.2 4.9-7.1 9.4-2.6 4.9-2.1 6.1-1.5 11.4 0.2 10.2-1 9.7-4.9 9.9-2.1 2.1-4.7 3.5-2.2 2.2-1 2.3-1.7 5.8-4.8 8.4-2.9 13.1-2.1 5.9-10.3 14.8-1.3 2.7-13.9 11.8-3.3 3.8-0.4 2.7 0.6 6.2-0.2 2.8-1.2 3.2-2.2 3.5-4.7 6.1-4.7 4.5-16.1 10.7-10.8 11.9-2.7 1.4-2.1 2.7-5.2 13.5-2.6 5-8 10-3.3 6-1.9 12.3-4.8 16.8-9.5 16.7-1.4 5.7-1.7 16.1 0.3 14.7z" },
        {
        id: "penghu-county",
        name: "澎湖縣",
        region: "yunjianan",
        path: "M321.6 920.5l-2.6-3.7l9.8-0.9l-1.3 5.6l-1.8-0.4l-1.7 1.5l0.2 2.9l-3-2.3l0.3-2.6z M368.3 758.9l2.1-1.9l-2 4.9l-0.1-3z M370.2 763.9l1.4-2.1l0.1 1.6l2.6 1.1l0.5 1.6l-2 0.5l-0.1 1.2l-1.4-1l1.2 1.1l-1.9-0.3l-1.4 3.7l-1.7-3.9l2.7-3.5z M356.9 776.1l-0.7-3.8l1.6 0.6l-1 3.2z M384.1 790.3l-0.9-0.6l2.3-2.6l0.9 2.8l-2.3 0.4z M344.8 905.7l2.5-2.8l0.9 0.9l-1.5 2.1l-1.9-0.2z M385.7 904.8l3.1-1.7l0.8 1.2l-2.4 4.7l-1.7-1.9l0.2-2.3z M371.2 908.1l-0.4-1.2l3.3-0.4l0 2.4l-3-0.7z M340.5 869.7l0.9-1.8l-1.3-2.7l2.7 2.3l1.3-1.4l0.6 4.9l1.3 0l-1.4 1.4l2.3-0.4l-0.1 1.6l-2.4 1.2l1.6 3.2l-7-1l2.2-2.7l-0.6-4.5z M294.1 864.3l1.1-3.3l2.9 2l-1.8 1.7l-2.3-0.4z M348.6 874.1l0.9-1.8l2.5-1l1.9 3.1l-3-0.5l-2.1 2.8l-1.5-2l1.3-0.5z M345.4 902.6l-2.2-1.8l1.8-0.1l0.4 2z M347.5 833.3l-1.3-0.4l1.6-1.5l-0.2 1.9z M345.5 840.7l-0.5-2.3l1.9 1.3l0.9-1.6l4.4-1.7l1.6 1.3l-8.2 3z M363.6 789.6l-2.6-0.2l-2 3.1l-2.3-1.7l-3.2 4.1l-0.8 3l-5.5 1l1.3 7.8l-0.9 2.1l-1.9 0.7l1.1 1.9l-1.2 1.3l1.1 4.5l-5.2-1l-1.7 1.6l-5.7 0.6l3.5-4.3l2.8 1.6l3-2.7l-0.3-3.2l-3.3-1.1l1.2-0.5l-0.1-1.7l1.2 1.8l1.6-0.5l-0.5-2.4l1.6-2l-2.5-2.1l3.3-8.1l2 0l-1.4-2.1l2.6-0.1l-0.7 3.7l4.4 0.9l4.1-5.1l-0.9-1.5l1.1-1.7l3.9-0.5l-0.5-0.6l3.7-1.4l2.2 1.6l2.4-0.6l1.5 1.6l-1.1 0.8l2.2 0.5l-0.9 1.2l1.9 1.9l-0.7 1.5l-2.7-0.2l0.5 1.8l-1.3 0.6l1.4 1.7l2-0.6l-2.1 2l1 2.2l1.9 0.2l-0.9 2.7l0.8 2.5l1-0.9l-0.2 1.4l1.1-0.4l-0.2-1.4l1.4-0.8l1.5 0.5l-1.5 2l-0.2 6l1.4 0l2.1-5.6l1.1 0.7l-0.5 2.6l1.1-0.1l1.9-5.2l-0.9-0.2l2-0.6l0.1 3l2.7 0.9l-1.5 0l0.5 1.7l1.6-0.4l-0.4-1.4l1.4-1.5l2.8 4.9l0.1 5.2l1.4 1.2l1.1-0.6l0.9 2.9l-4.8 0.7l-1.8-3.1l-6.7 0.6l-1.6 1.4l0.5 1l-1.6 0.1l0.1 1.3l-2.9 0.6l-0.7 1.9l-1.9 0l-2.3 2.6l0.3 1.9l1.4 0.1l-1.6 1.6l0.5 2.4l-4.1-1.4l-5.2 1.2l0.2-3.8l-2.1-1.2l-2 0.8l-2.3-3l0.3-1.4l-2.2 0l0.3-2.6l0.8 0.4l0.9-2.1l0.2 3.8l1.9 0.9l-0.5 2.5l1.6 0.6l1.1-2.3l1.7 0.8l0.7 3.5l2.2-3.7l3.5 1.7l1-1.6l-1.1-0.1l-0.2-1.6l2.1-0.6l-0.8-1.4l1.1-0.9l-2.5 0l-0.6-1.4l-0.2 1.1l-0.9-0.7l-3.7 1.9l-1.1-1.7l-1.2 1l-0.7-2.6l2.5 1.1l1.1-0.6l-0.8-1.3l1.2 0.2l-1.3-1.3l1.2 0.8l0.8-0.8l-1.4-1.3l-1.6 1.7l-3.3-0.4l3.1-3.3l-1.5-2.9l3.4 0l2.3-2.7l0.6 3.8l-1 0.2l1.8-0.2l-0.5 2.7l1.9-1l0.8 1.7l1.3-2.3l-1.2 0l0.2-1.7l2.3-0.9l0-3.1l-1.1-1.2l0.7-1.3l1.8 0.1l-4-3l2.2-1.2l-0.3-1.4l-1.2 1.3l-1.2-1.2l-1.8 0.6l1.9-3.7l-4.3-6l0.4-1.5z",}
    ];

const speedMapPage = document.querySelector(".speed-map-page");
if (speedMapPage) {
    const map = speedMapPage.querySelector("#taiwanRegionMap");
    const title = speedMapPage.querySelector("#regionMapTitle");
    const counties = speedMapPage.querySelector("#regionMapCounties");
    const link = speedMapPage.querySelector("#regionMapLink");
    const linkText = speedMapPage.querySelector("#regionMapLinkText");

    const regionInfo = {
        north: {
            label: "北北基地區",
            counties: "基隆市、台北市、新北市",
            color: "#27e1bb",
            glow: "rgba(39, 225, 187, 0.55)",
            url: "https://www.youtube.com/watch?v=QVE98aA90os&list=PLjZKU2OCXBSXzzwRLLyXvcIW-KtCYZTqh&pp=sAgC",
        },
        taoyuanHsinchu: {
            label: "桃園/新竹地區",
            counties: "桃園市、新竹縣、新竹市",
            color: "#52a9ff",
            glow: "rgba(82, 169, 255, 0.55)",
            url: "https://www.youtube.com/watch?v=WV26_nT6eY&list=PLjZKU2OCXBSXyGkD1y1andkta7GZp3Nf&pp=sAgC",
        },
        miaoli: {
            label: "苗栗地區",
            counties: "苗栗縣",
            color: "#ffc857",
            glow: "rgba(255, 200, 87, 0.5)",
            url: "https://www.youtube.com/watch?v=YRYVzgLUC8Q&list=PLjZKU2OCXBSUFNEXv1o4oCR2pWsAMpsW7&pp=sAgC",
        },
        taichung: {
            label: "台中地區",
            counties: "台中市",
            color: "#ff8f70",
            glow: "rgba(255, 143, 112, 0.5)",
            url: "https://www.youtube.com/watch?v=v8xDLDXlXpc&list=PLjZKU2OCXBSXqSinJJSHWfwbNbIA74jKW&pp=sAgC",
        },
        changhuaNantou: {
            label: "彰化/南投地區",
            counties: "彰化縣、南投縣",
            color: "#a6e36f",
            glow: "rgba(166, 227, 111, 0.48)",
            url: "https://www.youtube.com/watch?v=4QxJvmGWMGQ&list=PLjZKU2OCXBSV7jVbHn1tUzxMj_faTy4kI&pp=sAgC",
        },
        yunjianan: {
            label: "雲嘉南地區",
            counties: "雲林縣、嘉義縣、嘉義市、台南市、澎湖縣",
            color: "#f69bd3",
            glow: "rgba(246, 155, 211, 0.46)",
            url: "https://www.youtube.com/watch?v=ZdTp07WJ94s&list=PLjZKU2OCXBSWMXi26mgZ7mH_jd5P6GdfO&pp=sAgC",
        },
        kaoping: {
            label: "高屏地區",
            counties: "高雄市、屏東縣",
            color: "#ff6f91",
            glow: "rgba(255, 111, 145, 0.48)",
            url: "https://www.youtube.com/watch?v=SJvS0mVzT74&list=PLjZKU2OCXBSUv1vOSOLUjpY3--pmOpZSy&pp=sAgC",
        },
        east: {
            label: "宜花東地區",
            counties: "宜蘭縣、花蓮縣、台東縣",
            color: "#b38cff",
            glow: "rgba(179, 140, 255, 0.5)",
            url: "https://www.youtube.com/watch?v=cPqAtKANEm8&list=PLjZKU2OCXBSWGd2JgLt_aSj2YVvOewLto&pp=sAgC",
        },
    };

    const countyPaths = taiwanMapCountyPaths;

    const setActiveRegion = (regionKey) => {
        const info = regionInfo[regionKey];
        if (!info || !map || !title || !counties || !link || !linkText) {
            return;
        }

        map.classList.add("has-active");
        title.textContent = info.label;
        counties.textContent = info.counties;
        link.href = info.url;
        linkText.textContent = `開啟${info.label}播放清單`;

        map.querySelectorAll(".taiwan-county").forEach((county) => {
            county.classList.toggle("is-active", county.dataset.region === regionKey);
        });
    };

    countyPaths.forEach((county) => {
        const info = regionInfo[county.region];
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", county.path);
        path.setAttribute("id", county.id);
        path.setAttribute("class", "taiwan-county");
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "link");
        path.setAttribute("aria-label", `${county.name}，${info.label}，開啟 YouTube 播放清單`);
        path.dataset.region = county.region;
        path.style.setProperty("--region-color", info.color);
        path.style.setProperty("--region-glow", info.glow);

        path.addEventListener("mouseenter", () => setActiveRegion(county.region));
        path.addEventListener("focus", () => setActiveRegion(county.region));
        path.addEventListener("click", () => {
            window.open(info.url, "_blank", "noopener,noreferrer");
        });
        path.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                window.open(info.url, "_blank", "noopener,noreferrer");
            }
        });

        map.append(path);
    });

    setActiveRegion("north");
}

const drillCountdownModal = document.querySelector("#drillCountdownModal");
if (drillCountdownModal) {
    const drillCountdownTarget = new Date("2026-08-10T14:30:00+08:00").getTime();
    const countdownTime = drillCountdownModal.querySelector("#drillCountdownTime");
    const countdownClose = drillCountdownModal.querySelector("#drillCountdownClose");
    const countdownMap = drillCountdownModal.querySelector("#drillCountdownMap");
    const drillCounties = new Set(["台中市", "苗栗縣", "南投縣", "彰化縣", "雲林縣", "嘉義縣", "嘉義市"]);
    let countdownTimer = null;

    const closeDrillCountdown = () => {
        drillCountdownModal.hidden = true;
        if (countdownTimer) {
            window.clearInterval(countdownTimer);
            countdownTimer = null;
        }
        document.removeEventListener("keydown", handleDrillCountdownKeydown);
    };

    function handleDrillCountdownKeydown(event) {
        if (event.key === "Escape") {
            closeDrillCountdown();
        }
    }

    const formatCountdownValue = (value) => String(value).padStart(2, "0");

    const updateDrillCountdown = () => {
        const remaining = drillCountdownTarget - Date.now();
        if (remaining <= 0) {
            closeDrillCountdown();
            return;
        }

        const totalSeconds = Math.floor(remaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (countdownTime) {
            countdownTime.textContent = `${formatCountdownValue(hours)}:${formatCountdownValue(minutes)}:${formatCountdownValue(seconds)}`;
        }
    };

    if (countdownMap && Array.isArray(taiwanMapCountyPaths)) {
        taiwanMapCountyPaths.forEach((county) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const isDrillArea = drillCounties.has(county.name);
            path.setAttribute("d", county.path);
            path.setAttribute("id", `drill-${county.id}`);
            path.setAttribute("class", `taiwan-county${isDrillArea ? " is-drill-area" : ""}`);
            path.setAttribute("aria-label", isDrillArea ? `${county.name}，演練區域` : county.name);
            countdownMap.append(path);
        });
    }

    if (Date.now() < drillCountdownTarget) {
        updateDrillCountdown();
        drillCountdownModal.hidden = false;
        countdownTimer = window.setInterval(updateDrillCountdown, 1000);
        document.addEventListener("keydown", handleDrillCountdownKeydown);
        if (countdownClose) {
            countdownClose.focus();
        }
    }

    if (countdownClose) {
        countdownClose.addEventListener("click", closeDrillCountdown);
    }
}

const spectrumPage = document.querySelector(".spectrum-page");
if (spectrumPage) {
    const filters = spectrumPage.querySelectorAll('.operator-filter input[type="checkbox"]');
    const spectrumGrid = spectrumPage.querySelector(".spectrum-grid");
    const slotCodePattern = /^[A-Z]\d+(?:-\d+)?$/;
    const applySpectrumFilters = () => {
        filters.forEach((input) => {
            spectrumPage.classList.toggle(`hide-${input.value}`, !input.checked);
        });
    };

    if (spectrumGrid) {
        const columns = spectrumGrid.style.getPropertyValue("--spectrum-cols").trim().split(/\s+/);
        if (columns.length > 8) {
            columns[1] = "8px";
            columns[2] = "17px";
            columns[3] = "17px";
            columns[4] = "17px";
            columns[5] = "17px";
            columns[6] = "17px";
            columns[7] = "8px";
            spectrumGrid.style.setProperty("--spectrum-cols", columns.join(" "));
        }
    }

    spectrumPage.querySelectorAll(".spectrum-cell.no-fill").forEach((cell) => {
        if (slotCodePattern.test(cell.textContent.trim())) {
            cell.classList.add("slot-code");
        }
    });

    filters.forEach((input) => {
        input.addEventListener("change", applySpectrumFilters);
    });
    applySpectrumFilters();
}

const maxSpeedPage = document.querySelector(".max-speed-page");
const speedDatabasePage = document.querySelector(".speed-database-page");
if (speedDatabasePage) {
    const source = window.speedDatabaseSource || {};
    const columns = Array.isArray(source.columns) ? source.columns : [];
    const displayColumns = [
        "影片",
        "測試電信",
        "測試時間",
        "測試地點",
        "所處行政區",
        "測試內容",
        "測試頻段",
        "APN AMBR",
        "測試終端",
        "使用軟體",
        "輔助說明",
        "播放倍速",
        "測試專案",
        "所屬播放清單",
    ].filter((column) => columns.includes(column));
    const columnLabels = {
        影片: "測試影片(點選可觀看)",
    };
    const searchableColumns = displayColumns.filter((column) => column !== "所屬播放清單");
    const rows = Array.isArray(source.rows) ? source.rows : [];
    const operatorSelect = speedDatabasePage.querySelector("#databaseOperator");
    const contentSelect = speedDatabasePage.querySelector("#databaseContent");
    const playlistSelect = speedDatabasePage.querySelector("#databasePlaylist");
    const projectSelect = speedDatabasePage.querySelector("#databaseProject");
    const searchForm = speedDatabasePage.querySelector("#databaseSearchForm");
    const keywordInput = speedDatabasePage.querySelector("#databaseKeyword");
    const tableHead = speedDatabasePage.querySelector("#speedDatabaseHead");
    const tableBody = speedDatabasePage.querySelector("#speedDatabaseBody");
    const countLabel = speedDatabasePage.querySelector("#speedDatabaseCount");
    let activeKeyword = "";

    const operatorRules = {
        all: () => true,
        cht: (value) => value === "46692 中華電信 (CHT)",
        fet: (value) => value === "46601 遠傳電信 (FET)",
        twm: (value) => value === "46697 台灣大哥大 (TWM)" || value === "46689 台灣之星 (TWM(TS))",
        tstar: (value) => value === "46689 台灣之星 (TST)",
        apt: (value) => value === "46605 亞太電信 (GT)",
    };

    const contentRules = {
        all: () => true,
        speedtest: (value) => value === "SpeedTest",
        signal: (value) => value.includes("Signal Coverage"),
        moving: (value) => value.includes("Moving Downlink Throughput"),
    };

    const collator = new Intl.Collator("zh-Hant-TW", { numeric: true });
    const operatorColorRules = [
        { key: "cht", terms: ["中華電信"] },
        { key: "fet", terms: ["遠傳電信"] },
        { key: "twm", terms: ["台灣大哥大"] },
        { key: "apt", terms: ["亞太電信"] },
        { key: "tstar", terms: ["台灣之星"] },
    ];
    const cityOrder = [
        "基隆市",
        "台北市",
        "新北市",
        "桃園市",
        "新竹縣",
        "新竹市",
        "苗栗縣",
        "台中市",
        "彰化縣",
        "南投縣",
        "雲林縣",
        "嘉義縣",
        "嘉義市",
        "台南市",
        "高雄市",
        "屏東縣",
        "宜蘭縣",
        "花蓮縣",
        "台東縣",
        "澎湖縣",
        "連江縣",
        "金門縣",
    ];
    const validCities = new Set(cityOrder);

    const uniqueValues = (column) => [...new Set(rows
        .map((row) => String(row[column] || "").trim())
        .filter(Boolean))]
        .sort(collator.compare);

    const getCityFromDistrict = (value) => {
        const matched = String(value || "").trim().match(/^\d{3}([\u4e00-\u9fff]{3})/);
        if (!matched || !["縣", "市"].includes(matched[1][2])) {
            return "";
        }
        const city = matched[1].replace(/^臺/, "台");
        return validCities.has(city) ? city : "";
    };

    const uniqueCities = () => {
        const availableCities = new Set(rows
        .map((row) => getCityFromDistrict(row["所處行政區"]))
            .filter(Boolean));
        return cityOrder.filter((city) => availableCities.has(city));
    };

    const isVisibleProjectOption = (value) => {
        const project = String(value || "");
        return project
            && !project.includes("要求測試")
            && !project.includes("自費案件")
            && !project.includes("@")
            && !/(https?:\/\/|www\.|youtu\.be|youtube\.com)/i.test(project);
    };

    const uniqueProjectValues = () => [...new Set(rows
        .map((row) => String(row["測試專案"] || "").trim())
        .filter(isVisibleProjectOption))]
        .sort(collator.compare);

    const fillSelect = (select, values) => {
        values.forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.append(option);
        });
    };

    const renderHead = () => {
        const row = document.createElement("tr");
        displayColumns.forEach((column) => {
            const cell = document.createElement("th");
            cell.scope = "col";
            cell.textContent = columnLabels[column] || column;
            row.append(cell);
        });
        tableHead.replaceChildren(row);
    };

    const appendDataCell = (rowElement, row, column) => {
        const cell = document.createElement("td");
        const text = String(row[column] || "");

        if (column === "影片" && row["影片連結"]) {
            const link = document.createElement("a");
            link.className = "speed-database-link";
            link.href = row["影片連結"];
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = text;
            const icon = document.createElement("span");
            icon.className = "external-link-icon";
            icon.setAttribute("aria-hidden", "true");
            link.append(icon);
            cell.append(link);
        } else {
            cell.textContent = text;
        }

        if (text.length > 18) {
            cell.title = text;
        }
        rowElement.append(cell);
    };

    const matchesFilters = (row) => {
        const operatorRule = operatorRules[operatorSelect.value] || operatorRules.all;
        const contentRule = contentRules[contentSelect.value] || contentRules.all;
        const cityValue = playlistSelect.value;
        const projectValue = projectSelect.value;
        const rowMatchesKeyword = !activeKeyword || searchableColumns
            .some((column) => String(row[column] || "").toLowerCase().includes(activeKeyword));

        return operatorRule(String(row["測試電信"] || ""))
            && contentRule(String(row["測試內容"] || ""))
            && (cityValue === "all" || getCityFromDistrict(row["所處行政區"]) === cityValue)
            && (
                projectValue === "all"
                || (projectValue === "__empty" && !String(row["測試專案"] || "").trim())
                || row["測試專案"] === projectValue
            )
            && rowMatchesKeyword;
    };

    const getOperatorColorClass = (row) => {
        const operatorValue = String(row["測試電信"] || "");
        const matchedOperators = operatorColorRules
            .filter((rule) => rule.terms.some((term) => operatorValue.includes(term)));

        return matchedOperators.length === 1 ? `operator-${matchedOperators[0].key}` : "";
    };

    const renderRows = () => {
        const filteredRows = rows.filter(matchesFilters);
        const fragment = document.createDocumentFragment();

        filteredRows.forEach((row) => {
            const rowElement = document.createElement("tr");
            const operatorColorClass = getOperatorColorClass(row);
            if (operatorColorClass) {
                rowElement.classList.add(operatorColorClass);
            }
            displayColumns.forEach((column) => appendDataCell(rowElement, row, column));
            fragment.append(rowElement);
        });

        if (!filteredRows.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = Math.max(displayColumns.length, 1);
            cell.className = "speed-database-empty";
            cell.textContent = "沒有符合條件的資料";
            row.append(cell);
            fragment.append(row);
        }

        tableBody.replaceChildren(fragment);
        countLabel.textContent = `顯示 ${filteredRows.length.toLocaleString("zh-TW")} / ${rows.length.toLocaleString("zh-TW")} 筆`;
    };

    if (columns.length && rows.length && operatorSelect && contentSelect && playlistSelect && projectSelect && searchForm && keywordInput && tableHead && tableBody && countLabel) {
        fillSelect(playlistSelect, uniqueCities());
        fillSelect(projectSelect, uniqueProjectValues());
        renderHead();
        renderRows();

        [operatorSelect, contentSelect, playlistSelect, projectSelect].forEach((select) => {
            select.addEventListener("change", renderRows);
        });

        searchForm.addEventListener("submit", (event) => {
            event.preventDefault();
            activeKeyword = keywordInput.value.trim().toLowerCase();
            renderRows();
        });
    }
}

if (maxSpeedPage) {
    const calculator = maxSpeedPage.querySelector(".speed-calculator");
    const technologySelect = maxSpeedPage.querySelector("#speedTechnology");
    const directionSelect = maxSpeedPage.querySelector("#speedDirection");
    const operatorSelect = maxSpeedPage.querySelector("#speedOperator");
    const form = maxSpeedPage.querySelector("#maxSpeedForm");
    const quickConfigOptions = maxSpeedPage.querySelector("#quickConfigOptions");
    const quickConfigFieldset = quickConfigOptions?.closest(".speed-fieldset");
    const bandOptions = maxSpeedPage.querySelector("#bandOptions");
    const bandFieldsetLegend = maxSpeedPage.querySelector("#bandFieldsetLegend");
    const ulCa = maxSpeedPage.querySelector("#ulCa");
    const ulCaFieldset = maxSpeedPage.querySelector("#ulCaFieldset");
    const output = maxSpeedPage.querySelector("#maxSpeedOutput");
    const outputLabel = maxSpeedPage.querySelector("#maxSpeedLabel");
    const speedLimitNote = maxSpeedPage.querySelector("#speedLimitNote");
    const hint = maxSpeedPage.querySelector("#bandHint");
    const qam256 = maxSpeedPage.querySelector("#qam256");

    const lteOperatorBands = {
        cht: [
            { id: "b1-500", label: "B1[500]", speed: 147, macroDouble: true },
            { id: "b3-1400", label: "B3[1400]", speed: 72, macroDouble: true },
            { id: "b3-1750", label: "B3[1750]", speed: 147, macroDouble: true },
            { id: "b7-3050", label: "B7[3050]", speed: 147, macroDouble: true },
            { id: "b7-3400", label: "B7[3400]", speed: 72, macroDouble: false },
            { id: "b8-3650", label: "B8[3650]", speed: 72, macroDouble: false, exclusiveGroup: "b8" },
            { id: "b8-3750", label: "B8[3750]", speed: 72, macroDouble: false, exclusiveGroup: "b8" },
        ],
        fet: [
            { id: "fet-b1-75", label: "B1[75]", speed: 112, macroDouble: true },
            { id: "fet-b3-1550", label: "B3[1550]", speed: 145, macroDouble: true },
            { id: "fet-b7-3250", label: "B7[3250]", speed: 145, macroDouble: true, conflictGroup: "fet-b7" },
            { id: "fet-b28-9310", label: "B28[9310]", speed: 145, macroDouble: false, exclusiveGroup: "fet-b28" },
            { id: "fet-b28-9435", label: "B28[9435]", speed: 37, macroDouble: false, exclusiveGroup: "fet-b28" },
            { id: "fet-tdd-37900", label: "B38/B41[37900/40540]", speed: 112, macroDouble: true, conflictGroup: "fet-tdd" },
            { id: "fet-tdd-38098", label: "B38/B41[38098/40738]", speed: 112, macroDouble: true, conflictGroup: "fet-tdd" },
        ],
        twm: [
            { id: "twm-b1-250", label: "B1[250]", speed: 145, macroDouble: true },
            { id: "twm-b1-375", label: "B1[375]", speed: 37, macroDouble: false },
            { id: "twm-b3-1275", label: "B3[1275]", speed: 112, macroDouble: true },
            { id: "twm-b7-2850", label: "B7[2850]", speed: 145, macroDouble: true, exclusiveGroup: "twm-b7-b8" },
            { id: "twm-b8-3525", label: "B8[3525]", speed: 37, macroDouble: false, exclusiveGroup: "twm-b7-b8" },
            { id: "twm-b28-9560", label: "B28[9560]", speed: 145, macroDouble: false },
        ],
    };

    const nsaOperatorBands = {
        cht: [
            { id: "n1-432030", label: "N1[432030]", speed: 225, category: "5g", indoorHalf: true },
            { id: "n8-191090", label: "N8 DSS[191090]", speed: 85, category: "5g" },
            { id: "n78-630912", label: "N78[630912]", speed: 1200, category: "5g" },
            ...lteOperatorBands.cht.map((band) => ({ ...band, category: "4g" })),
        ],
        fet: [
            { id: "fet-n28-dss-152670", label: "N28 DSS[152670]", speed: 120, category: "5g", exclusiveGroup: "fet-n28-nsa" },
            { id: "fet-n28-156010", label: "N28[156010]", speed: 48, category: "5g", exclusiveGroup: "fet-n28-nsa" },
            { id: "fet-n38-n41-517230", label: "N38/N41[517230]", speed: 480, category: "5g" },
            { id: "fet-n78-623328", label: "N78[623328]", speed: 1100, category: "5g" },
            ...lteOperatorBands.fet.map((band) => ({ ...band, category: "4g" })),
        ],
        twm: [
            { id: "twm-n28-dss-158690", label: "N28 DSS[158690]", speed: 120, category: "5g", indoorHalf: true },
            { id: "twm-n78-620736", label: "N78[620736]", speed: 450, category: "5g" },
            { id: "twm-n78-634752", label: "N78[634752]", speed: 700, category: "5g" },
            ...lteOperatorBands.twm.map((band) => ({ ...band, category: "4g" })),
        ],
    };

    const lteUploadOperatorBands = {
        cht: [
            { id: "ul-b1-18500", label: "B1[18500]", speed: 70 },
            { id: "ul-b3-19400", label: "B3[19400]", speed: 35 },
            { id: "ul-b3-19750", label: "B3[19750]", speed: 70 },
            { id: "ul-b7-21050", label: "B7[21050]", speed: 70 },
            { id: "ul-b7-21400", label: "B7[21400]", speed: 35 },
            { id: "ul-b8-21650", label: "B8[21650]", speed: 30 },
            { id: "ul-b8-21750", label: "B8[21750]", speed: 32 },
        ],
        fet: [
            { id: "ul-fet-b1-18075", label: "B1[18075]", speed: 50 },
            { id: "ul-fet-b3-19550", label: "B3[19550]", speed: 70 },
            { id: "ul-fet-b7-21250", label: "B7[21250]", speed: 70 },
            { id: "ul-fet-b28-27310", label: "B28[27310]", speed: 63 },
            { id: "ul-fet-b28-27435", label: "B28[27435]", speed: 12 },
            { id: "ul-fet-tdd-37900", label: "B38/B41[37900/40540]", speed: 12, ulCa: true },
            { id: "ul-fet-tdd-38098", label: "B38/B41[38098/40738]", speed: 12, ulCa: true },
        ],
        twm: [
            { id: "ul-twm-b1-18250", label: "B1[18250]", speed: 68 },
            { id: "ul-twm-b1-18375", label: "B1[18375]", speed: 12, indoorOnly: true },
            { id: "ul-twm-b3-19275", label: "B3[19275]", speed: 45 },
            { id: "ul-twm-b7-20850", label: "B7[20850]", speed: 68 },
            { id: "ul-twm-b8-21525", label: "B8[21525]", speed: 12 },
            { id: "ul-twm-b28-27560", label: "B28[27560]", speed: 63 },
        ],
    };

    const nsaUploadOperatorBands = {
        cht: [
            { id: "ul-n1-394000", label: "N1[394000]", speed: 115, category: "5g" },
            { id: "ul-n8-dss-182000", label: "N8 DSS[182000]", speed: 45, category: "5g" },
            { id: "ul-n78-631000", label: "N78[631000]", speed: 160, category: "5g" },
            ...lteUploadOperatorBands.cht.map((band) => ({ ...band, category: "4g" })),
        ],
        fet: [
            { id: "ul-fet-n28-dss-142600", label: "N28 DSS[142600]", speed: 85, category: "5g" },
            { id: "ul-fet-n28-145100", label: "N28[145100]", speed: 0, category: "5g", disabledAlways: true },
            { id: "ul-fet-n38-n41-517230", label: "N38/N41[517230]", speed: 0, category: "5g", disabledAlways: true },
            { id: "ul-fet-n78-625334", label: "N78[625334]", speed: 140, category: "5g" },
            ...lteUploadOperatorBands.fet.map((band) => ({ ...band, category: "4g" })),
        ],
        twm: [
            { id: "ul-twm-n28-dss-147600", label: "N28 DSS[147600]", speed: 75, category: "5g" },
            { id: "ul-twm-n78-621334", label: "N78[621334]", speed: 70, category: "5g" },
            { id: "ul-twm-n78-636000", label: "N78[636000]", speed: 110, category: "5g" },
            ...lteUploadOperatorBands.twm.map((band) => ({ ...band, category: "4g" })),
        ],
    };

    const operatorBandsByDirection = {
        downlink: {
            lte: lteOperatorBands,
            nsa: nsaOperatorBands,
        },
        uplink: {
            lte: lteUploadOperatorBands,
            nsa: nsaUploadOperatorBands,
        },
    };

    const quickConfigurations = {
        "cht-5ca": {
            technology: "lte",
            operator: "cht",
            bands: ["b3-1400", "b3-1750", "b7-3050", "b7-3400", "b8-3650"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用中華電信 5CA 快速配置。",
        },
        "cht-4ca": {
            technology: "lte",
            operator: "cht",
            bands: ["b3-1750", "b7-3050", "b7-3400", "b8-3650"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用中華電信 4CA 快速配置。",
        },
        "cht-3ca": {
            technology: "lte",
            operator: "cht",
            bands: ["b3-1750", "b7-3050", "b8-3650"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用中華電信 3CA 快速配置。",
        },
        "fet-4ca": {
            technology: "lte",
            operator: "fet",
            bands: ["fet-b1-75", "fet-b3-1550", "fet-b7-3250", "fet-b28-9310"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用遠傳電信 4CA 快速配置。",
        },
        "fet-4ca-tdd": {
            technology: "lte",
            operator: "fet",
            bands: ["fet-b1-75", "fet-b3-1550", "fet-tdd-37900", "fet-tdd-38098"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用遠傳電信 4CA(有TDD) 快速配置。",
        },
        "fet-3ca": {
            technology: "lte",
            operator: "fet",
            bands: ["fet-b3-1550", "fet-b7-3250", "fet-b28-9310"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用遠傳電信 3CA 快速配置。",
        },
        "twm-4ca": {
            technology: "lte",
            operator: "twm",
            bands: ["twm-b1-250", "twm-b3-1275", "twm-b7-2850", "twm-b28-9560"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用台灣大哥大 4CA 快速配置。",
        },
        "twm-3ca": {
            technology: "lte",
            operator: "twm",
            bands: ["twm-b1-250", "twm-b3-1275", "twm-b28-9560"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用台灣大哥大 3CA 快速配置。",
        },
        "twm-2ca": {
            technology: "lte",
            operator: "twm",
            bands: ["twm-b3-1275", "twm-b28-9560"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用台灣大哥大 2CA 快速配置。",
        },
        "cht-nsa-nr-2ca-lte-4ca": {
            technology: "nsa",
            operator: "cht",
            bands: ["n1-432030", "n78-630912", "b3-1400", "b7-3050", "b7-3400", "b8-3650"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用中華電信 NR 2CA + LTE 4CA 快速配置。",
        },
        "cht-nsa-nr-lte-5ca": {
            technology: "nsa",
            operator: "cht",
            bands: ["n78-630912", "b3-1400", "b3-1750", "b7-3050", "b7-3400", "b8-3650"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用中華電信 NR + LTE 5CA 快速配置。",
        },
        "fet-nsa-nr-2ca-lte-2ca": {
            technology: "nsa",
            operator: "fet",
            bands: ["fet-n38-n41-517230", "fet-n78-623328", "fet-b1-75", "fet-b7-3250"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用遠傳電信 NR 2CA + LTE 2CA 快速配置。",
        },
        "fet-nsa-nr-2ca-lte-3ca": {
            technology: "nsa",
            operator: "fet",
            bands: ["fet-n28-dss-152670", "fet-n78-623328", "fet-b1-75", "fet-b3-1550", "fet-b7-3250"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用遠傳電信 NR 2CA + LTE 3CA 快速配置。",
        },
        "fet-nsa-nr-lte-4ca": {
            technology: "nsa",
            operator: "fet",
            bands: ["fet-n78-623328", "fet-b1-75", "fet-b3-1550", "fet-b7-3250", "fet-b28-9310"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用遠傳電信 NR + LTE 4CA 快速配置。",
        },
        "twm-nsa-nr-2ca-lte-4ca": {
            technology: "nsa",
            operator: "twm",
            bands: ["twm-n78-620736", "twm-n78-634752", "twm-b1-250", "twm-b3-1275", "twm-b7-2850", "twm-b28-9560"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用台灣大哥大 NR 2CA + LTE 4CA 快速配置。",
        },
        "twm-nsa-nr-2ca-lte-3ca": {
            technology: "nsa",
            operator: "twm",
            bands: ["twm-n28-dss-158690", "twm-n78-634752", "twm-b1-250", "twm-b3-1275", "twm-b7-2850"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用台灣大哥大 NR 2CA + LTE 3CA 快速配置。",
        },
        "twm-nsa-nr-lte-4ca": {
            technology: "nsa",
            operator: "twm",
            bands: ["twm-n78-634752", "twm-b1-250", "twm-b3-1275", "twm-b7-2850", "twm-b28-9560"],
            siteType: "outdoor",
            qam256: true,
            label: "已套用台灣大哥大 NR + LTE 4CA 快速配置。",
        },
    };

    const quickConfigLabels = {
        lte: {
            cht: [
                { id: "cht-5ca", label: "5CA" },
                { id: "cht-4ca", label: "4CA" },
                { id: "cht-3ca", label: "3CA" },
            ],
            fet: [
                { id: "fet-4ca", label: "4CA" },
                { id: "fet-4ca-tdd", label: "4CA(有TDD)" },
                { id: "fet-3ca", label: "3CA" },
            ],
            twm: [
                { id: "twm-4ca", label: "4CA" },
                { id: "twm-3ca", label: "3CA" },
                { id: "twm-2ca", label: "2CA" },
            ],
        },
        nsa: {
            cht: [
                { id: "cht-nsa-nr-2ca-lte-4ca", label: "NR 2CA + LTE 4CA" },
                { id: "cht-nsa-nr-lte-5ca", label: "NR + LTE 5CA" },
            ],
            fet: [
                { id: "fet-nsa-nr-2ca-lte-2ca", label: "NR 2CA + LTE 2CA" },
                { id: "fet-nsa-nr-2ca-lte-3ca", label: "NR 2CA + LTE 3CA" },
                { id: "fet-nsa-nr-lte-4ca", label: "NR + LTE 4CA" },
            ],
            twm: [
                { id: "twm-nsa-nr-2ca-lte-4ca", label: "NR 2CA + LTE 4CA" },
                { id: "twm-nsa-nr-2ca-lte-3ca", label: "NR 2CA + LTE 3CA" },
                { id: "twm-nsa-nr-lte-4ca", label: "NR + LTE 4CA" },
            ],
        },
    };

    const defaultHints = {
        downlink: {
            lte: {
                cht: "最多可選 5 個頻段；B8[3650] 與 B8[3750] 不可同時選取。",
                fet: "最多可選 4 個頻段；僅指定特殊組合可選 5 個。",
                twm: "B7[2850] 與 B8[3525] 不可同時選取；B1[375] 僅限室內站。",
            },
            nsa: {
                cht: "5G 至少需選 1 個頻段。",
                fet: "5G 最多可選 2 個頻段；N28 DSS[152670] 與 N28[156010] 不可同時選取。",
                twm: "5G 最多可選 2 個頻段；N28 DSS[158690] 與 B8[3525]、B28[9560] 不可同時選取。",
            },
        },
        uplink: {
            lte: {
                cht: "上傳僅能選擇 1 個 4G 頻段。",
                fet: "上傳僅能選擇 1 個 4G 頻段；遠傳電信未開啟上傳256QAM。",
                twm: "上傳僅能選擇 1 個 4G 頻段；B1[18375] 僅限室內站。",
            },
            nsa: {
                cht: "5G NSA 上傳至少需選 1 個 5G 頻段；5G 與 4G 各最多 1 個。",
                fet: "5G NSA 上傳至少需選 1 個 5G 頻段；5G 與 4G 各最多 1 個，遠傳電信未開啟上傳256QAM。",
                twm: "5G NSA 上傳至少需選 1 個 5G 頻段；5G 與 4G 各最多 1 個。",
            },
        },
    };

    const selectedDirection = () => directionSelect?.value || "downlink";
    const selectedTechnology = () => technologySelect.value;
    const isUplink = () => selectedDirection() === "uplink";
    const activeBands = () => operatorBandsByDirection[selectedDirection()]?.[selectedTechnology()]?.[operatorSelect.value] || [];
    const activeHint = () => defaultHints[selectedDirection()]?.[selectedTechnology()]?.[operatorSelect.value] || "";
    const selectedQuickConfig = () => form.querySelector('input[name="quickConfig"]:checked')?.value || "manual";
    const hasFetTddSelected = () => Boolean(
        form.querySelector('input[value="fet-tdd-37900"]:checked, input[value="fet-tdd-38098"]:checked'),
    );
    const hasTwmIndoorOnlyBandSelected = () => Boolean(
        form.querySelector('input[value="twm-b1-375"]:checked'),
    );

    const updateSiteTypeRestrictions = (showMessage = false) => {
        const indoorInput = form.querySelector('input[name="siteType"][value="indoor"]');
        const outdoorInput = form.querySelector('input[name="siteType"][value="outdoor"]');
        const macroInput = form.querySelector('input[name="siteType"][value="macro"]');
        if (isUplink()) {
            indoorInput.disabled = false;
            outdoorInput.disabled = false;
            macroInput.disabled = false;
            const shouldDisableIndoor = operatorSelect.value === "fet" && hasFetUploadTddSelected();
            const shouldForceIndoor = operatorSelect.value === "twm" && hasTwmUploadIndoorOnlyBandSelected();
            indoorInput.disabled = shouldDisableIndoor;
            outdoorInput.disabled = shouldForceIndoor;
            macroInput.disabled = shouldForceIndoor;
            if (shouldDisableIndoor && indoorInput.checked) {
                outdoorInput.checked = true;
                if (showMessage) {
                    hint.textContent = "勾選 B38/B41 時，站台類型不可選擇室內站。";
                    hint.classList.add("is-warning");
                }
            }
            if (shouldForceIndoor && !indoorInput.checked) {
                indoorInput.checked = true;
                if (showMessage) {
                    hint.textContent = "勾選 B1[18375] 時，站台類型只能選擇室內站。";
                    hint.classList.add("is-warning");
                }
            }
            updateUploadExtras();
            return;
        }

        const shouldDisableIndoor = operatorSelect.value === "fet" && hasFetTddSelected();
        const shouldForceIndoor = operatorSelect.value === "twm" && hasTwmIndoorOnlyBandSelected();

        if (!form.classList.contains("is-quick-mode")) {
            indoorInput.disabled = false;
            outdoorInput.disabled = false;
            macroInput.disabled = false;
            indoorInput.disabled = shouldDisableIndoor;
            outdoorInput.disabled = shouldForceIndoor;
            macroInput.disabled = shouldForceIndoor;
        }

        if (shouldDisableIndoor && indoorInput.checked) {
            outdoorInput.checked = true;
            if (showMessage) {
                hint.textContent = "勾選 B38/B41 時，站台類型不可選擇室內站。";
                hint.classList.add("is-warning");
            }
        }

        if (shouldForceIndoor && !indoorInput.checked) {
            indoorInput.checked = true;
            if (showMessage) {
                hint.textContent = "勾選 B1[375] 時，站台類型只能選擇室內站。";
                hint.classList.add("is-warning");
            }
        }
    };

    const setManualControlsDisabled = (disabled) => {
        form.classList.toggle("is-quick-mode", disabled);
        form.querySelectorAll('input[data-band-input], input[name="siteType"], #qam256').forEach((input) => {
            input.disabled = disabled;
        });
    };

    const applyQuickConfig = () => {
        const configId = selectedQuickConfig();
        const config = quickConfigurations[configId];
        if (!config || config.technology !== selectedTechnology() || config.operator !== operatorSelect.value) {
            setManualControlsDisabled(false);
            updateSiteTypeRestrictions(false);
            if (activeBands().length) {
                hint.textContent = activeHint();
                hint.classList.remove("is-warning");
            }
            return;
        }

        form.querySelectorAll('input[data-band-input]').forEach((input) => {
            input.checked = config.bands.includes(input.value);
        });

        const siteInput = form.querySelector(`input[name="siteType"][value="${config.siteType}"]`);
        if (siteInput) {
            siteInput.checked = true;
        }

        qam256.checked = config.qam256;
        hint.textContent = config.label;
        hint.classList.remove("is-warning");
        setManualControlsDisabled(true);
    };

    const renderQuickConfigs = () => {
        if (isUplink()) {
            if (quickConfigFieldset) {
                quickConfigFieldset.hidden = true;
            }
            quickConfigOptions.innerHTML = "";
            setManualControlsDisabled(false);
            return;
        }

        if (quickConfigFieldset) {
            quickConfigFieldset.hidden = false;
        }

        const configs = quickConfigLabels[selectedTechnology()]?.[operatorSelect.value] || [];
        quickConfigOptions.innerHTML = `
            <label>
                <input type="radio" name="quickConfig" value="manual" checked>
                <span>手動設定</span>
            </label>
        `;

        configs.forEach((config) => {
            const label = document.createElement("label");
            label.innerHTML = `
                <input type="radio" name="quickConfig" value="${config.id}">
                <span>${config.label}</span>
            `;
            quickConfigOptions.append(label);
        });
    };

    const renderBands = () => {
        const bands = activeBands();
        bandOptions.innerHTML = "";
        qam256.checked = !isUplink();
        if (outputLabel) {
            outputLabel.textContent = isUplink() ? "最快上傳網速" : "最快下載網速";
        }
        if (bandFieldsetLegend) {
            bandFieldsetLegend.textContent = isUplink() ? "連接的主頻段(P Cell)" : "站台開啟頻段";
        }

        if (!bands.length) {
            bandOptions.innerHTML = '<p class="speed-hint">此制式與業者的頻段、計算規則待補。</p>';
            hint.textContent = activeHint();
            hint.classList.remove("is-warning");
            setManualControlsDisabled(false);
            updateSiteTypeRestrictions(false);
            return;
        }

        let lastCategory = "";
        let hasRendered5gNote = false;
        const render5gNote = () => {
            if (hasRendered5gNote) {
                return;
            }

            const note = document.createElement("small");
            note.className = "band-group-note";
            note.textContent = "5G頻段預設已開啟256QAM調變";
            bandOptions.append(note);
            hasRendered5gNote = true;
        };

        bands.forEach((band) => {
            if (band.category && band.category !== lastCategory) {
                if (lastCategory === "5g") {
                    render5gNote();
                }

                const title = document.createElement("div");
                title.className = "band-group-title";
                title.textContent = band.category === "5g" ? "5G 頻段" : "4G頻段";
                bandOptions.append(title);
                if (isUplink() && selectedTechnology() === "nsa" && band.category === "4g") {
                    const noneLabel = document.createElement("label");
                    noneLabel.className = "band-option";
                    noneLabel.innerHTML = `
                        <input type="radio" name="band-nsa-4g" value="none-4g" data-band-input checked>
                        <span>不選 4G頻段</span>
                    `;
                    bandOptions.append(noneLabel);
                }
                lastCategory = band.category;
            }

            const label = document.createElement("label");
            label.className = "band-option";
            const inputType = isUplink() ? "radio" : "checkbox";
            const inputName = isUplink()
                ? `band-${selectedTechnology()}-${band.category || "lte"}`
                : "band";
            label.innerHTML = `
                <input type="${inputType}" name="${inputName}" value="${band.id}" data-band-input>
                <span>${band.label}</span>
            `;
            bandOptions.append(label);
        });

        if (lastCategory === "5g") {
            render5gNote();
        }

        hint.textContent = activeHint();
        hint.classList.remove("is-warning");
        applyQuickConfig();
    };

    const getSelectedBands = () => {
        const bands = activeBands();
        const checkedIds = new Set(
            Array.from(form.querySelectorAll('input[data-band-input]:checked')).map((input) => input.value),
        );
        return bands.filter((band) => checkedIds.has(band.id));
    };

    const selectedBandIds = () => new Set(
        Array.from(form.querySelectorAll('input[data-band-input]:checked')).map((input) => input.value),
    );

    const sameSet = (ids, expected) => ids.size === expected.length && expected.every((id) => ids.has(id));
    const isNsaCht = () => selectedTechnology() === "nsa" && operatorSelect.value === "cht";
    const isNsaFet = () => selectedTechnology() === "nsa" && operatorSelect.value === "fet";
    const isNsaTwm = () => selectedTechnology() === "nsa" && operatorSelect.value === "twm";
    const isUplinkNsaCht = () => isUplink() && selectedTechnology() === "nsa" && operatorSelect.value === "cht";
    const selectedUploadBands = () => getSelectedBands();
    const hasFetUploadTddSelected = () => selectedUploadBands().some((band) => band.ulCa);
    const hasTwmUploadIndoorOnlyBandSelected = () => selectedUploadBands().some((band) => band.indoorOnly);

    const updateUploadExtras = () => {
        const isFetUpload = isUplink() && operatorSelect.value === "fet";
        if (ulCaFieldset) {
            ulCaFieldset.hidden = !(isFetUpload && hasFetUploadTddSelected());
        }
        if (ulCa && ulCaFieldset?.hidden) {
            ulCa.checked = false;
        }
        if (qam256) {
            qam256.disabled = isFetUpload;
            if (isFetUpload) {
                qam256.checked = false;
            }
        }
    };

    const validateFetBands = () => {
        const ids = selectedBandIds();
        const specialFiveCa = ["fet-b1-75", "fet-b3-1550", "fet-b7-3250", "fet-b28-9310", "fet-tdd-37900"];
        const hasB7 = ids.has("fet-b7-3250");
        const hasTdd = ids.has("fet-tdd-37900") || ids.has("fet-tdd-38098");
        const allowedWithB28Alt = new Set(["fet-b28-9435", "fet-b3-1550", "fet-tdd-37900", "fet-tdd-38098"]);

        if (ids.has("fet-b28-9310") && ids.has("fet-b28-9435")) {
            return "B28[9310] 和 B28[9435] 不可同時勾選。";
        }

        if (ids.has("fet-b28-9435") && Array.from(ids).some((id) => !allowedWithB28Alt.has(id))) {
            return "勾選 B28[9435] 時，只可再勾 B3[1550] 或 B38/B41。";
        }

        if (hasB7 && hasTdd && !sameSet(ids, specialFiveCa)) {
            return "B7 與 B38/B41 不可同時勾選，特殊 5CA 組合除外。";
        }

        if (ids.size > 4 && !sameSet(ids, specialFiveCa)) {
            return "遠傳最多只能勾選 4 個；僅指定特殊組合可勾 5 個。";
        }

        return "";
    };

    const bandById = (id) => activeBands().find((band) => band.id === id);

    const disabledReasonForBand = (band, ids) => {
        if (!band || ids.has(band.id)) {
            return "";
        }

        if (band.disabledAlways) {
            return "此上傳頻段目前不可選";
        }

        const selectedBands = activeBands().filter((item) => ids.has(item.id));
        const selected5g = selectedBands.filter((item) => item.category === "5g");
        const selected4g = selectedBands.filter((item) => item.category === "4g");

        if (isUplink()) {
            if (operatorSelect.value === "fet") {
                if (selectedTechnology() === "nsa" && band.id === "ul-fet-b28-27435") {
                    return "5G NSA 下不可選";
                }
                if (band.id === "ul-fet-b28-27310" && ids.has("ul-fet-n28-dss-142600")) {
                    return "N28 DSS 已占用 B28";
                }
                if (band.id === "ul-fet-n28-dss-142600" && ids.has("ul-fet-b28-27310")) {
                    return "B28 已被選取";
                }
            }

            if (operatorSelect.value === "twm") {
                if ((band.id === "ul-twm-b8-21525" || band.id === "ul-twm-b28-27560") && ids.has("ul-twm-n28-dss-147600")) {
                    return "N28 DSS 已占用 B8/B28";
                }
                if (band.id === "ul-twm-n28-dss-147600" && (ids.has("ul-twm-b8-21525") || ids.has("ul-twm-b28-27560"))) {
                    return "B8/B28 已被選取";
                }
            }

            if (isUplinkNsaCht()) {
                if (band.id === "ul-b1-18500" && ids.has("ul-n1-394000")) {
                    return "N1 已占用 B1";
                }
                if ((band.id === "ul-b8-21650" || band.id === "ul-b8-21750") && ids.has("ul-n8-dss-182000")) {
                    return "N8 DSS 已占用 B8";
                }
                if (band.id === "ul-n1-394000" && ids.has("ul-b1-18500")) {
                    return "B1 已被選取";
                }
                if (band.id === "ul-n8-dss-182000" && (ids.has("ul-b8-21650") || ids.has("ul-b8-21750"))) {
                    return "B8 已被選取";
                }
            }
        }

        if (band.exclusiveGroup && selectedBands.some((item) => item.exclusiveGroup === band.exclusiveGroup)) {
            return "同頻段互斥";
        }

        if (selectedTechnology() === "lte" && selectedBands.length >= 5) {
            if (operatorSelect.value !== "fet") {
                return "已達可選頻段上限";
            }

            const specialFiveCa = ["fet-b1-75", "fet-b3-1550", "fet-b7-3250", "fet-b28-9310", "fet-tdd-37900"];
            const nextIds = new Set([...ids, band.id]);
            if (!sameSet(nextIds, specialFiveCa)) {
                return "已達可選頻段上限";
            }
        }

        if (isNsaCht()) {
            if (band.category === "5g" && ids.has("n8-191090")) {
                return "N8 DSS 與其他 5G 頻段互斥";
            }
            if (band.id === "n8-191090" && (ids.has("n1-432030") || ids.has("n78-630912"))) {
                return "N8 DSS 與其他 5G 頻段互斥";
            }
            if (band.id === "b1-500" && ids.has("n1-432030")) {
                return "N1 已占用 B1";
            }
            if ((band.id === "b8-3650" || band.id === "b8-3750") && ids.has("n8-191090")) {
                return "N8 DSS 已占用 B8";
            }
            if (band.id === "n1-432030" && ids.has("b1-500")) {
                return "B1 已被選取";
            }
            if (band.id === "n8-191090" && (ids.has("b8-3650") || ids.has("b8-3750"))) {
                return "B8 已被選取";
            }
            if (band.category === "4g" && ids.has("n1-432030") && ids.has("n78-630912") && selected4g.length >= 4) {
                return "4G 頻段已達上限";
            }
            if (band.category === "4g" && selected4g.length >= 5) {
                return "4G 頻段已達上限";
            }
        }

        if (isNsaFet()) {
            if (band.category === "5g" && selected5g.length >= 2) {
                return "5G 頻段已達上限";
            }
            if ((band.id === "fet-b28-9310" || band.id === "fet-b28-9435") && (ids.has("fet-n28-dss-152670") || ids.has("fet-n28-156010") || ids.has("fet-n38-n41-517230"))) {
                return "與已選 5G 頻段互斥";
            }
            if ((band.id === "fet-n28-dss-152670" || band.id === "fet-n28-156010") && (ids.has("fet-b28-9310") || ids.has("fet-b28-9435"))) {
                return "與已選 4G B28 互斥";
            }
            if (
                ids.has("fet-n38-n41-517230")
                && (band.id === "fet-b7-3250" || band.id === "fet-tdd-37900" || band.id === "fet-tdd-38098")
            ) {
                return "與 N38/N41 互斥";
            }
            if (
                band.id === "fet-n38-n41-517230"
                && (ids.has("fet-b7-3250") || ids.has("fet-tdd-37900") || ids.has("fet-tdd-38098") || ids.has("fet-b28-9310") || ids.has("fet-b28-9435"))
            ) {
                return "與已選 4G 頻段互斥";
            }

            const next4gIds = new Set(
                [...ids, band.id].filter((id) => bandById(id)?.category === "4g"),
            );
            if (band.category === "4g" && validateFetLteIds(next4gIds)) {
                return "不符合遠傳 4G 組合限制";
            }
        }

        if (isNsaTwm()) {
            if (band.category === "5g" && selected5g.length >= 2) {
                return "5G 頻段已達上限";
            }
            if ((band.id === "twm-b8-3525" || band.id === "twm-b28-9560") && ids.has("twm-n28-dss-158690")) {
                return "與 N28 DSS 互斥";
            }
            if (band.id === "twm-n28-dss-158690" && (ids.has("twm-b8-3525") || ids.has("twm-b28-9560"))) {
                return "與已選 4G 頻段互斥";
            }
        }

        return "";
    };

    const validateUplinkBands = () => {
        const selectedBands = getSelectedBands();
        const ids = selectedBandIds();
        const selected5g = selectedBands.filter((band) => band.category === "5g");
        const selected4g = selectedBands.filter((band) => band.category === "4g");

        if (selectedTechnology() === "lte") {
            return selectedBands.length > 1 ? "上傳僅能選擇 1 個 4G 頻段。" : "";
        }

        if (!selected5g.length) {
            return "5G NSA 上傳至少需勾選 1 個 5G 頻段。";
        }

        if (selected5g.length > 1) {
            return "5G 上傳僅能選擇 1 個頻段。";
        }

        if (selected4g.length > 1) {
            return "4G 上傳僅能選擇 1 個頻段。";
        }

        if (isUplinkNsaCht()) {
            if (ids.has("ul-n1-394000") && ids.has("ul-b1-18500")) {
                return "勾選 N1[394000] 時，不可再勾選 B1[18500]。";
            }
            if (ids.has("ul-n8-dss-182000") && (ids.has("ul-b8-21650") || ids.has("ul-b8-21750"))) {
                return "勾選 N8 DSS[182000] 時，不可再勾選 B8[21650] 或 B8[21750]。";
            }
        }

        if (operatorSelect.value === "fet" && selectedTechnology() === "nsa") {
            if (ids.has("ul-fet-n28-145100") || ids.has("ul-fet-n38-n41-517230")) {
                return "N28[145100] 與 N38/N41[517230] 目前不可選。";
            }
            if (ids.has("ul-fet-b28-27435")) {
                return "5G NSA 下，B28[27435] 不可選。";
            }
            if (ids.has("ul-fet-n28-dss-142600") && ids.has("ul-fet-b28-27310")) {
                return "勾選 N28 DSS[142600] 時，不可再勾選 B28[27310]。";
            }
        }

        if (operatorSelect.value === "twm" && selectedTechnology() === "nsa") {
            if (ids.has("ul-twm-n28-dss-147600") && (ids.has("ul-twm-b8-21525") || ids.has("ul-twm-b28-27560"))) {
                return "勾選 N28 DSS[147600] 時，不可再勾選 B8[21525] 或 B28[27560]。";
            }
        }

        return "";
    };

    const updateBandAvailability = () => {
        if (form.classList.contains("is-quick-mode")) {
            return;
        }

        const ids = selectedBandIds();
        form.querySelectorAll('input[data-band-input]').forEach((input) => {
            const band = bandById(input.value);
            const reason = disabledReasonForBand(band, ids);
            const label = input.closest(".band-option");

            input.disabled = Boolean(reason);
            label?.classList.toggle("is-disabled", Boolean(reason));
            if (label) {
                label.title = reason;
            }
        });
    };

    const validateFetLteIds = (ids) => {
        const specialFiveCa = ["fet-b1-75", "fet-b3-1550", "fet-b7-3250", "fet-b28-9310", "fet-tdd-37900"];
        const hasB7 = ids.has("fet-b7-3250");
        const hasTdd = ids.has("fet-tdd-37900") || ids.has("fet-tdd-38098");
        const allowedWithB28Alt = new Set(["fet-b28-9435", "fet-b3-1550", "fet-tdd-37900", "fet-tdd-38098"]);

        if (ids.has("fet-b28-9310") && ids.has("fet-b28-9435")) {
            return "B28[9310] 和 B28[9435] 不可同時勾選。";
        }

        if (ids.has("fet-b28-9435") && Array.from(ids).some((id) => !allowedWithB28Alt.has(id))) {
            return "勾選 B28[9435] 時，只可再勾 B3[1550] 或 B38/B41。";
        }

        if (hasB7 && hasTdd && !sameSet(ids, specialFiveCa)) {
            return "B7 與 B38/B41 不可同時勾選，特殊 5CA 組合除外。";
        }

        if (ids.size > 4 && !sameSet(ids, specialFiveCa)) {
            return "遠傳 4G 頻段最多只能勾選 4 個；僅指定特殊組合可勾 5 個。";
        }

        return "";
    };

    const validateChtNsaBands = () => {
        const ids = selectedBandIds();
        const selected5g = getSelectedBands().filter((band) => band.category === "5g");
        const selected4g = getSelectedBands().filter((band) => band.category === "4g");

        if (!selected5g.length) {
            return "5G NSA 至少需勾選 1 個 5G 頻段。";
        }

        if (ids.has("n8-191090") && (ids.has("n1-432030") || ids.has("n78-630912"))) {
            return "N8[191090] 不可與 N1[432030] 或 N78[630912] 同時勾選。";
        }

        if (ids.has("n1-432030") && ids.has("b1-500")) {
            return "勾選 N1[432030] 時，不可再勾選 B1[500]。";
        }

        if (ids.has("n8-191090") && (ids.has("b8-3650") || ids.has("b8-3750"))) {
            return "勾選 N8[191090] 時，不可再勾選 B8[3650] 或 B8[3750]。";
        }

        if (ids.has("n1-432030") && ids.has("n78-630912") && selected4g.length > 4) {
            return "同時勾選 N1[432030] 與 N78[630912] 時，4G 頻段最多只能勾選 4 個。";
        }

        if (selected4g.length > 5) {
            return "4G 錨點頻段最多只能勾選 5 個。";
        }

        return "";
    };

    const validateFetNsaBands = () => {
        const ids = selectedBandIds();
        const selected5g = getSelectedBands().filter((band) => band.category === "5g");
        const selected4gIds = new Set(
            getSelectedBands()
                .filter((band) => band.category === "4g")
                .map((band) => band.id),
        );

        if (!selected5g.length) {
            return "5G NSA 至少需勾選 1 個 5G 頻段。";
        }

        if (ids.has("fet-n28-dss-152670") && ids.has("fet-n28-156010")) {
            return "N28 DSS[152670] 與 N28[156010] 不可同時勾選。";
        }

        if (selected5g.length > 2) {
            return "遠傳 5G 頻段最多只能勾選 2 項。";
        }

        if (
            (ids.has("fet-n28-dss-152670") || ids.has("fet-n28-156010"))
            && (ids.has("fet-b28-9310") || ids.has("fet-b28-9435"))
        ) {
            return "勾選 N28 DSS[152670] 或 N28[156010] 時，不可再勾選 B28[9310] 或 B28[9435]。";
        }

        if (
            ids.has("fet-n38-n41-517230")
            && (
                ids.has("fet-tdd-37900")
                || ids.has("fet-tdd-38098")
                || ids.has("fet-b7-3250")
                || ids.has("fet-b28-9310")
                || ids.has("fet-b28-9435")
            )
        ) {
            return "勾選 N38/N41[517230] 時，不可再勾選 B7、B38/B41 或 B28。";
        }

        return validateFetLteIds(selected4gIds);
    };

    const validateTwmNsaBands = () => {
        const ids = selectedBandIds();
        const selected5g = getSelectedBands().filter((band) => band.category === "5g");

        if (!selected5g.length) {
            return "5G NSA 至少需勾選 1 個 5G 頻段。";
        }

        if (selected5g.length > 2) {
            return "台灣大哥大 5G 頻段最多只能勾選 2 項。";
        }

        if (ids.has("twm-n28-dss-158690") && (ids.has("twm-b8-3525") || ids.has("twm-b28-9560"))) {
            return "勾選 N28 DSS[158690] 時，不可再勾選 B8[3525] 或 B28[9560]。";
        }

        return "";
    };

    const updateNsaChtHint = () => {
        if (!isNsaCht()) {
            return true;
        }

        const message = validateChtNsaBands();
        if (message) {
            hint.textContent = message;
            hint.classList.add("is-warning");
            return false;
        }

        hint.textContent = activeHint();
        hint.classList.remove("is-warning");
        return true;
    };

    const updateNsaFetHint = () => {
        if (!isNsaFet()) {
            return true;
        }

        const message = validateFetNsaBands();
        if (message) {
            hint.textContent = message;
            hint.classList.add("is-warning");
            return false;
        }

        hint.textContent = activeHint();
        hint.classList.remove("is-warning");
        return true;
    };

    const updateNsaTwmHint = () => {
        if (!isNsaTwm()) {
            return true;
        }

        const message = validateTwmNsaBands();
        if (message) {
            hint.textContent = message;
            hint.classList.add("is-warning");
            return false;
        }

        hint.textContent = activeHint();
        hint.classList.remove("is-warning");
        return true;
    };

    const updateSpeedLimitNote = (total) => {
        const operator = operatorSelect.value;
        let message = "";

        if (isUplink()) {
            if (operator === "cht" && total > 200) {
                message = "中華電信APN AMBR UL最高為200Mbps。";
            }

            if (operator === "fet" && total > 200) {
                message = "遠傳電信APN AMBR UL最高為200Mbps。";
            }
        } else {
            if (operator === "cht" && total > 1600) {
                message = "中華電信APN AMBR最高為1600Mbps。";
            }

            if (operator === "fet" && total > 1500) {
                message = "遠傳電信APN AMBR最高為1500Mbps。";
            }

            if (operator === "twm" && total > 2000) {
                message = "台灣大哥大APN AMBR最高為2000Mbps。";
            }
        }

        speedLimitNote.textContent = message;
        speedLimitNote.hidden = !message;
    };

    const enforceBandRules = (changedInput) => {
        if (!changedInput || !changedInput.matches("input[data-band-input]") || !changedInput.checked) {
            return;
        }

        const bands = activeBands();
        const changedBand = bands.find((band) => band.id === changedInput.value);
        if (isUplink()) {
            form.querySelectorAll('input[data-band-input]:checked').forEach((input) => {
                const band = bands.find((item) => item.id === input.value);
                const sameUploadGroup = selectedTechnology() === "lte" || band?.category === changedBand?.category;
                if (input !== changedInput && sameUploadGroup) {
                    input.checked = false;
                }
            });

            const message = validateUplinkBands();
            if (message && !message.includes("至少需勾選")) {
                changedInput.checked = false;
                hint.textContent = message;
                hint.classList.add("is-warning");
            } else {
                hint.textContent = activeHint();
                hint.classList.remove("is-warning");
            }
            return;
        }

        if (changedBand?.exclusiveGroup) {
            form.querySelectorAll('input[data-band-input]:checked').forEach((input) => {
                const band = bands.find((item) => item.id === input.value);
                if (input !== changedInput && band?.exclusiveGroup === changedBand.exclusiveGroup) {
                    input.checked = false;
                }
            });
        }

        if (isNsaCht()) {
            const message = validateChtNsaBands();
            if (message) {
                changedInput.checked = false;
                hint.textContent = message;
                hint.classList.add("is-warning");
            } else {
                hint.textContent = activeHint();
                hint.classList.remove("is-warning");
            }
            return;
        }

        if (isNsaFet()) {
            const message = validateFetNsaBands();
            if (message) {
                changedInput.checked = false;
                hint.textContent = message;
                hint.classList.add("is-warning");
            } else {
                hint.textContent = activeHint();
                hint.classList.remove("is-warning");
            }
            return;
        }

        if (isNsaTwm()) {
            const message = validateTwmNsaBands();
            if (message) {
                changedInput.checked = false;
                hint.textContent = message;
                hint.classList.add("is-warning");
            } else {
                hint.textContent = activeHint();
                hint.classList.remove("is-warning");
            }
            updateSiteTypeRestrictions(!message);
            return;
        }

        if (operatorSelect.value === "fet") {
            const message = validateFetBands();
            if (message) {
                changedInput.checked = false;
                hint.textContent = message;
                hint.classList.add("is-warning");
            } else {
                hint.textContent = activeHint();
                hint.classList.remove("is-warning");
            }
            updateSiteTypeRestrictions(!message);
            return;
        }

        const checked = Array.from(form.querySelectorAll('input[data-band-input]:checked'));
        if (checked.length > 5) {
            changedInput.checked = false;
            hint.textContent = "所有選項最多只能勾選 5 個。";
            hint.classList.add("is-warning");
        } else {
            hint.textContent = activeHint();
            hint.classList.remove("is-warning");
        }
        updateSiteTypeRestrictions(true);
    };

    const calculateSpeed = () => {
        const selectedBands = getSelectedBands();
        updateBandAvailability();
        updateUploadExtras();
        if (!activeBands().length) {
            output.value = "0Mbps";
            speedLimitNote.hidden = true;
            hint.textContent = activeHint();
            hint.classList.remove("is-warning");
            return;
        }

        if (isUplink()) {
            const message = validateUplinkBands();
            if (message && selectedTechnology() === "nsa") {
                output.value = "0Mbps";
                speedLimitNote.hidden = true;
                hint.textContent = message;
                hint.classList.add("is-warning");
                return;
            }
        }

        if ((isNsaCht() || isNsaFet() || isNsaTwm()) && !selectedBands.some((band) => band.category === "5g")) {
            output.value = "0Mbps";
            speedLimitNote.hidden = true;
            updateNsaChtHint();
            updateNsaFetHint();
            updateNsaTwmHint();
            return;
        }

        const siteType = form.querySelector('input[name="siteType"]:checked')?.value || "outdoor";
        let total = selectedBands.reduce((sum, band) => {
            let speed = band.speed;
            if (isUplink()) {
                if (siteType === "indoor") {
                    speed *= 1.03;
                }
                if (band.ulCa && ulCa?.checked) {
                    speed *= 2;
                }
                if (qam256.checked && (selectedTechnology() === "lte" || band.category === "4g")) {
                    speed *= 1.33;
                }
            } else {
                if (siteType === "indoor" && (selectedTechnology() === "lte" || band.category === "4g" || band.indoorHalf)) {
                    speed *= 0.5;
                }
                if (siteType === "macro" && band.macroDouble) {
                    speed *= 2;
                }
                if (qam256.checked && (selectedTechnology() === "lte" || band.category === "4g")) {
                    speed *= 1.33;
                }
            }
            return sum + speed;
        }, 0);

        const rounded = Math.round(total * 10) / 10;
        output.value = `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}Mbps`;
        if (isUplink()) {
            updateSpeedLimitNote(total);
            if (!hint.classList.contains("is-warning")) {
                hint.textContent = activeHint();
            }
            return;
        }

        updateSpeedLimitNote(total);
        updateNsaChtHint();
        updateNsaFetHint();
        updateNsaTwmHint();
    };

    directionSelect?.addEventListener("change", () => {
        calculator.dataset.direction = selectedDirection();
        renderQuickConfigs();
        renderBands();
        calculateSpeed();
    });

    technologySelect.addEventListener("change", () => {
        calculator.dataset.technology = selectedTechnology();
        renderQuickConfigs();
        renderBands();
        calculateSpeed();
    });

    operatorSelect.addEventListener("change", () => {
        calculator.dataset.operator = operatorSelect.value;
        renderQuickConfigs();
        renderBands();
        calculateSpeed();
    });

    form.addEventListener("change", (event) => {
        if (event.target.name === "quickConfig") {
            applyQuickConfig();
            calculateSpeed();
            return;
        }

        enforceBandRules(event.target);
        if (event.target.matches("input[data-band-input]")) {
            updateSiteTypeRestrictions(false);
        }
        if (event.target.name === "siteType") {
            updateSiteTypeRestrictions(true);
        }
        calculateSpeed();
    });

    calculator.dataset.technology = selectedTechnology();
    calculator.dataset.direction = selectedDirection();
    renderQuickConfigs();
    renderBands();
    calculateSpeed();
}

const maintenancePage = document.querySelector(".maintenance-page");
if (maintenancePage) {
    const notices = Array.isArray(window.baseStationMaintenanceNotices)
        ? window.baseStationMaintenanceNotices
        : [];
    const meta = window.baseStationMaintenanceMeta || {};
    const calendar = maintenancePage.querySelector("#maintenanceCalendar");
    const detail = maintenancePage.querySelector("#maintenanceDetail");
    const yearPicker = maintenancePage.querySelector("#maintenanceYearPicker");
    const monthPicker = maintenancePage.querySelector("#maintenanceMonthPicker");
    const prevButton = maintenancePage.querySelector("#maintenancePrevMonth");
    const nextButton = maintenancePage.querySelector("#maintenanceNextMonth");
    const updated = maintenancePage.querySelector("#maintenanceUpdated");
    const currentDate = new Date();
    const todayKey = [
        currentDate.getFullYear(),
        String(currentDate.getMonth() + 1).padStart(2, "0"),
        String(currentDate.getDate()).padStart(2, "0"),
    ].join("-");
    const operatorInfo = {
        cht: { label: "中華電信", dotClass: "dot-cht" },
        fet: { label: "遠傳電信", dotClass: "dot-fet" },
        twm: { label: "台灣大哥大", dotClass: "dot-twm" },
    };
    const operatorOrder = ["cht", "fet", "twm"];

    const byDate = notices.reduce((map, notice) => {
        if (!notice.date || !operatorInfo[notice.operator] || !notice.text) {
            return map;
        }

        if (!map.has(notice.date)) {
            map.set(notice.date, {});
        }

        const dateBucket = map.get(notice.date);
        if (!dateBucket[notice.operator]) {
            dateBucket[notice.operator] = [];
        }
        dateBucket[notice.operator].push(notice.text);
        return map;
    }, new Map());

    const dataMonthKeys = [...new Set(notices.map((notice) => notice.date?.slice(0, 7)).filter(Boolean))]
        .sort()
        .reverse();

    const buildCalendarMonthKeys = (keys) => {
        if (!keys.length) {
            return [];
        }

        const oldest = keys[keys.length - 1].split("-").map(Number);
        const newest = keys[0].split("-").map(Number);
        const result = [];
        let year = newest[0];
        let month = newest[1];

        while (year > oldest[0] || (year === oldest[0] && month >= oldest[1])) {
            result.push(`${year}-${String(month).padStart(2, "0")}`);
            month -= 1;
            if (month === 0) {
                year -= 1;
                month = 12;
            }
        }

        return result;
    };

    const monthKeys = buildCalendarMonthKeys(dataMonthKeys);
    const monthsByYear = monthKeys.reduce((map, monthKey) => {
        const [year, month] = monthKey.split("-");
        if (!map.has(year)) {
            map.set(year, []);
        }
        map.get(year).push(month);
        return map;
    }, new Map());
    const yearKeys = [...monthsByYear.keys()].sort((a, b) => Number(b) - Number(a));
    let activeMonthKey = monthKeys[0] || "";

    const formatDateLabel = (dateKey) => {
        const [year, month, day] = dateKey.split("-");
        return `${year}/${month}/${day}`;
    };

    const makeDateKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const resetDetail = () => {
        detail.classList.remove("is-cht", "is-fet", "is-twm");
        detail.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "maintenance-detail-empty";
        empty.textContent = "點選月曆中的色點查看該日該業者公告內容。";
        detail.append(empty);
    };

    const renderDetail = (dateKey, operator) => {
        const texts = byDate.get(dateKey)?.[operator] || [];
        const info = operatorInfo[operator];
        detail.classList.remove("is-cht", "is-fet", "is-twm");
        detail.classList.add(`is-${operator}`);
        detail.replaceChildren();

        const heading = document.createElement("div");
        heading.className = "maintenance-detail-heading";

        const title = document.createElement("h2");
        title.textContent = `${formatDateLabel(dateKey)} ${info.label}`;

        const count = document.createElement("span");
        count.textContent = `${texts.length} 則公告`;

        heading.append(title, count);

        const list = document.createElement("ul");
        list.className = "maintenance-notice-list";
        texts.forEach((text) => {
            const item = document.createElement("li");
            item.className = "maintenance-notice";
            item.textContent = text;
            list.append(item);
        });

        detail.append(heading, list);
    };

    const setActiveDot = (button) => {
        calendar.querySelectorAll(".maintenance-dot-button.is-active").forEach((dotButton) => {
            dotButton.classList.remove("is-active");
        });
        button.classList.add("is-active");
    };

    const renderCalendar = () => {
        const monthKey = activeMonthKey;
        const [year, month] = monthKey.split("-").map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const start = new Date(year, month - 1, 1 - firstDay.getDay());

        calendar.replaceChildren();
        for (let index = 0; index < 42; index += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() + index);
            const dateKey = makeDateKey(date);
            const dayBucket = byDate.get(dateKey) || {};

            const dayCell = document.createElement("article");
            dayCell.className = "maintenance-day";
            if (date.getMonth() !== month - 1) {
                dayCell.classList.add("is-outside");
            }
            if (dateKey === todayKey) {
                dayCell.classList.add("is-today");
            }

            const number = document.createElement("span");
            number.className = "maintenance-day-number";
            number.textContent = String(date.getDate());

            const dots = document.createElement("div");
            dots.className = "maintenance-day-dots";
            operatorOrder.forEach((operator) => {
                if (!dayBucket[operator]?.length) {
                    return;
                }

                const button = document.createElement("button");
                button.className = `maintenance-dot-button ${operatorInfo[operator].dotClass}`;
                button.type = "button";
                button.setAttribute(
                    "aria-label",
                    `${formatDateLabel(dateKey)} ${operatorInfo[operator].label}公告 ${dayBucket[operator].length} 則`,
                );
                button.addEventListener("click", () => {
                    setActiveDot(button);
                    renderDetail(dateKey, operator);
                });
                dots.append(button);
            });

            dayCell.append(number, dots);
            calendar.append(dayCell);
        }

        const activeMonthIndex = monthKeys.indexOf(monthKey);
        yearPicker.value = String(year);
        monthPicker.value = String(month).padStart(2, "0");
        prevButton.disabled = activeMonthIndex >= monthKeys.length - 1;
        nextButton.disabled = activeMonthIndex <= 0;
        resetDetail();
    };

    const renderMonthPicker = (year) => {
        const months = monthsByYear.get(year) || [];
        monthPicker.replaceChildren();
        months.forEach((month) => {
            const option = document.createElement("option");
            option.value = month;
            option.textContent = `${Number(month)}月`;
            monthPicker.append(option);
        });
    };

    const setActiveMonth = (monthKey) => {
        if (!monthKeys.includes(monthKey)) {
            return;
        }

        activeMonthKey = monthKey;
        const [year, month] = monthKey.split("-");
        const hasMonthOption = [...monthPicker.options].some((option) => option.value === month);
        if (yearPicker.value !== year || !hasMonthOption) {
            renderMonthPicker(year);
        }
        renderCalendar();
    };

    if (updated && meta.updated) {
        updated.textContent = `資料更新於 ${meta.updated}，依發布日期彙整三大電信公告`;
    }

    if (monthKeys.length) {
        yearKeys.forEach((year) => {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = `${year}年`;
            yearPicker.append(option);
        });

        if (monthKeys.includes(todayKey.slice(0, 7))) {
            activeMonthKey = todayKey.slice(0, 7);
        }

        renderMonthPicker(activeMonthKey.slice(0, 4));

        yearPicker.addEventListener("change", () => {
            const months = monthsByYear.get(yearPicker.value) || [];
            const preferredMonth = monthPicker.value;
            renderMonthPicker(yearPicker.value);
            const month = months.includes(preferredMonth) ? preferredMonth : months[0];
            setActiveMonth(`${yearPicker.value}-${month}`);
        });

        monthPicker.addEventListener("change", () => {
            setActiveMonth(`${yearPicker.value}-${monthPicker.value}`);
        });

        prevButton.addEventListener("click", () => {
            const activeMonthIndex = monthKeys.indexOf(activeMonthKey);
            const nextIndex = Math.min(activeMonthIndex + 1, monthKeys.length - 1);
            setActiveMonth(monthKeys[nextIndex]);
        });

        nextButton.addEventListener("click", () => {
            const activeMonthIndex = monthKeys.indexOf(activeMonthKey);
            const nextIndex = Math.max(activeMonthIndex - 1, 0);
            setActiveMonth(monthKeys[nextIndex]);
        });

        renderCalendar();
    } else {
        calendar.textContent = "目前沒有可顯示的公告資料。";
        resetDetail();
    }
}

const nightSleepPage = document.querySelector(".night-sleep-page");
if (nightSleepPage) {
    const sleepData = {"times":["00:00","00:15","00:30","00:45","01:00","01:15","01:30","01:45","02:00","02:15","02:30","02:45","03:00","03:15","03:30","03:45","04:00","04:15","04:30","04:45","05:00","05:15","05:30","05:45","06:00","06:15","06:30","06:45","07:00","07:15","07:30","07:45","08:00"],"operators":[{"key":"cht","label":"中華電信","bands":[{"label":"4G 900MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]},{"label":"4G 1800MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]},{"label":"4G 2100MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]},{"label":"4G 2600MHz","values":[100,60,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,60,100,100,100,100,100,100,100,100]},{"label":"5G 2100MHz","values":[100,90,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,80,90,100,100,100,100,100,100,100,100]},{"label":"5G 3500MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]}]},{"key":"fet","label":"遠傳電信","bands":[{"label":"4G 700MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]},{"label":"4G 1800MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]},{"label":"4G 2100MHz","values":[100,100,100,100,70,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,40,60,80,90,100,100,100,100]},{"label":"4G 2600MHz","values":[100,100,100,100,40,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,40,70,90,100,100,100,100]},{"label":"4G TD2600MHz","values":[100,100,100,100,80,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,70,100,100,100,100]},{"label":"5G 3500MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]}]},{"key":"twm","label":"台灣大哥大","bands":[{"label":"4G 700MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]},{"label":"4G 900MHz","values":[100,100,100,100,100,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,80,80]},{"label":"4G 1800MHz","values":[100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100]},{"label":"4G 2100MHz","values":[100,100,100,60,50,40,40,40,40,40,40,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,100,100]},{"label":"4G 2600MHz","values":[100,100,100,100,100,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,100,100]},{"label":"5G 3500MHz","values":[100,100,100,100,100,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,100,100]}]}]};
    const slider = nightSleepPage.querySelector("#sleepTimeSlider");
    const playButton = nightSleepPage.querySelector("#sleepPlayButton");
    const clockLabel = nightSleepPage.querySelector("#sleepClockLabel");
    const hourHand = nightSleepPage.querySelector("#sleepClockHour");
    const minuteHand = nightSleepPage.querySelector("#sleepClockMinute");
    const operatorsRoot = nightSleepPage.querySelector("#sleepOperators");
    const videoGrid = nightSleepPage.querySelector("#sleepVideoGrid");
    const ticks = nightSleepPage.querySelector(".sleep-time-ticks");
    let playbackTimer = null;
    const operatorNotes = {
        cht: "2025年上半年開始實施些許站台2600MHz頻段夜間0時至6時休眠措施，並逐步提高比例，至2026年5月達到高峰，6月後又些許下調休眠站台比例。此外，部分5G n1頻段亦會實施休眠。",
        fet: "最早開始實施夜間休眠的業者，於1時至6時30分關閉大多數2600MHz站台，後續再加入2100MHz頻段。合併亞太電信後，其TDD2600頻段也納入夜間休眠行列，恢復間多在上午6時30分或7時。",
        twm: "主要進行2100MHz的夜間休眠措施，開始時間視站台訊務量而定，從0時45分至3時45分不等，並於上午7時45分左右恢復。合併台灣之星後，其900MHz和2600MHz亦會實施夜間休眠。此外，5G n78頻段也會視情況頻實施休眠，可能僅休眠[620736]頻點或是[620736]和[634752]皆關閉。",
    };
    const sleepVideos = [
        { id: "Wr17b0SOt_s", title: "電信業者會在半夜偷偷關閉基地台嗎？實際觀測整晚揭曉答案！[CC字幕]", thumbnail: "pic/night-sleep-video-Wr17b0SOt_s.jpg" },
        { id: "tXuNBA8P_hI", title: "台灣大哥大4G 基地台夜間省電 - Band3 關天線 (2022年10月)", thumbnail: "pic/night-sleep-video-tXuNBA8P_hI.jpg" },
        { id: "uHjSaZHaiWk", title: "台灣大哥大4G Band 1半夜關閉過程 | 原來功率是慢慢下降的啊~ (2023年11月)", thumbnail: "pic/night-sleep-video-uHjSaZHaiWk.jpg" },
        { id: "7DY4XhTMyS8", title: "遠傳電信4G 4CA連線 半夜未關頻省電的站台 (2023年5月)", thumbnail: "pic/night-sleep-video-7DY4XhTMyS8.jpg" },
        { id: "rR3JodbWWWY", title: "中華電信4G 半夜休眠Band 7的站台比率有所增加 (2025年4月)", thumbnail: "pic/night-sleep-video-rR3JodbWWWY.jpg" },
        { id: "-rqHuxvCJ10", title: "遠傳電信4G 淡水半夜頻段休眠情形 | B1、B7、B38都會關！(2025年12年)", thumbnail: "pic/night-sleep-video--rqHuxvCJ10.jpg" },
        { id: "RmT5TMb8hOA", title: "台灣大哥大4G 原來部分 Band 8 半夜也會休眠 (2025年5月)", thumbnail: "pic/night-sleep-video-RmT5TMb8hOA.jpg" },
        { id: "CLL6HDRGipM", title: "台灣大哥大5G 半夜2點關Band1記錄 | NR CA整夜都在 (2025年4月)", thumbnail: "pic/night-sleep-video-CLL6HDRGipM.jpg" },
        { id: "yKRogi5xFQo", title: "遠傳電信4G 半夜1時 至 清晨6時30分 關Band 7 雙機觀測 (2023年4月)", thumbnail: "pic/night-sleep-video-yKRogi5xFQo.jpg" },
        { id: "IgrJhI3zLmw", title: "台灣大哥大5G 板橋半夜B1/B8關台省電情形 | NR CA整夜都在 (2025年6月)", thumbnail: "pic/night-sleep-video-IgrJhI3zLmw.jpg" },
        { id: "Bev96oQnX_k", title: "台灣大哥大5G 半夜分階段關閉4G Band1 (2023年4月)", thumbnail: "pic/night-sleep-video-Bev96oQnX_k.jpg" },
        { id: "gfs2yIxShmA", title: "台灣大哥大4G 板橋半夜關台情形 | 2點關B8；2點15關一邊B1；4點15關另一邊B1 (2025年11月)", thumbnail: "pic/night-sleep-video-gfs2yIxShmA.jpg" },
        { id: "_Dm0SK8RN5Q", title: "台灣大哥大5G 半夜1點 n78[620736] 頻段休眠記錄 (2026年2月)", thumbnail: "pic/night-sleep-video-_Dm0SK8RN5Q.jpg" },
        { id: "PwTOSQ3fNjs", title: "遠傳電信4G 凌晨1點 陸續關Band 7省電 (2023年3月)", thumbnail: "pic/night-sleep-video-PwTOSQ3fNjs.jpg" },
        { id: "GTiiaCqgfQc", title: "遠傳電信4G 台東市郊 半夜B7收訊情形 (2023年4月)", thumbnail: "pic/night-sleep-video-GTiiaCqgfQc.jpg" },
        { id: "4SG7-iPgvUA", title: "遠傳電信4G & 台灣大哥大4G 宜蘭礁溪 半夜基地台頻段休眠情形 (2025年6月)", thumbnail: "pic/night-sleep-video-4SG7-iPgvUA.jpg" },
    ];

    sleepData.times.forEach(() => {
        const tick = document.createElement("span");
        ticks.append(tick);
    });

    const makeTower = (operator) => {
        const tower = document.createElement("img");
        tower.className = "sleep-tower";
        tower.src = assetPath(`pic/CellTower_${operator.key.toUpperCase()}.svg`);
        tower.alt = `${operator.label}基地台`;
        return tower;
    };

    const cards = sleepData.operators.map((operator) => {
        const card = document.createElement("article");
        card.className = `sleep-operator-card is-${operator.key}`;

        const header = document.createElement("header");
        const title = document.createElement("h2");
        title.textContent = operator.label;
        const count = document.createElement("span");
        count.className = "sleep-count";
        header.append(title, count);

        const body = document.createElement("div");
        body.className = "sleep-operator-body";

        const towerWrap = document.createElement("div");
        towerWrap.className = "sleep-tower-wrap";
        towerWrap.append(makeTower(operator));

        const bandList = document.createElement("div");
        bandList.className = "sleep-band-list";
        const rows = operator.bands.map((band) => {
            const row = document.createElement("div");
            row.className = "sleep-band-row";

            const label = document.createElement("span");
            label.className = "sleep-band-label";
            label.textContent = band.label;

            const bar = document.createElement("span");
            bar.className = "sleep-bar";
            const fill = document.createElement("span");
            fill.className = "sleep-bar-fill";
            bar.append(fill);

            const zzz = document.createElement("span");
            zzz.className = "sleep-zzz";
            zzz.append(document.createTextNode("zZ"));
            const strongZ = document.createElement("strong");
            strongZ.textContent = "Z";
            zzz.append(strongZ);

            row.append(label, bar, zzz);
            bandList.append(row);
            return { row, fill, band };
        });

        body.append(towerWrap, bandList);
        const note = document.createElement("p");
        note.className = "sleep-operator-note";
        note.textContent = operatorNotes[operator.key] || "";

        card.append(header, body, note);
        operatorsRoot.append(card);
        return { operator, card, count, towerWrap, rows };
    });

    sleepVideos.forEach((video) => {
        const card = document.createElement("a");
        card.className = "sleep-video-card";
        card.href = `https://www.youtube.com/watch?v=${video.id}`;
        card.target = "_blank";
        card.rel = "noopener noreferrer";

        const image = document.createElement("img");
        image.src = assetPath(video.thumbnail);
        image.alt = "";
        image.loading = "lazy";

        const title = document.createElement("strong");
        title.textContent = video.title;

        card.append(image, title);
        videoGrid.append(card);
    });

    const updateClock = (time) => {
        const [hours, minutes] = time.split(":").map(Number);
        const hourRotation = ((hours % 12) + minutes / 60) * 30;
        const minuteRotation = minutes * 6;
        clockLabel.textContent = time;
        hourHand.style.setProperty("--hand-rotation", `${hourRotation}deg`);
        minuteHand.style.setProperty("--hand-rotation", `${minuteRotation}deg`);
    };

    const renderTime = () => {
        const index = Number(slider.value);
        const time = sleepData.times[index] || sleepData.times[0];
        updateClock(time);

        cards.forEach(({ operator, count, towerWrap, rows }) => {
            let sleepingBands = 0;

            rows.forEach(({ row, fill, band }) => {
                const value = Math.max(0, Math.min(100, Number(band.values[index]) || 0));
                const isSleeping = value < 100;
                if (isSleeping) {
                    sleepingBands += 1;
                }
                row.classList.toggle("is-sleeping", isSleeping);
                fill.style.setProperty("--sleep-value", `${value}%`);
            });

            const brightness = Math.max(0.3, 1 - (sleepingBands / operator.bands.length) * 0.7);
            towerWrap.style.setProperty("--tower-brightness", brightness.toFixed(2));
            count.textContent = sleepingBands ? `${sleepingBands} 個頻段休眠` : "全頻段運行";
        });
    };

    const setPlaying = (isPlaying) => {
        playButton.classList.toggle("is-playing", isPlaying);
        playButton.setAttribute("aria-pressed", String(isPlaying));
        playButton.setAttribute("aria-label", isPlaying ? "暫停時間軸" : "播放時間軸");
    };

    const stopPlayback = () => {
        if (playbackTimer) {
            window.clearInterval(playbackTimer);
            playbackTimer = null;
        }
        setPlaying(false);
    };

    const advancePlayback = () => {
        const nextValue = Number(slider.value) + 1;
        if (nextValue > Number(slider.max)) {
            stopPlayback();
            return;
        }
        slider.value = String(nextValue);
        renderTime();
        if (nextValue >= Number(slider.max)) {
            stopPlayback();
        }
    };

    const startPlayback = () => {
        if (Number(slider.value) >= Number(slider.max)) {
            slider.value = "0";
            renderTime();
        }
        stopPlayback();
        setPlaying(true);
        playbackTimer = window.setInterval(advancePlayback, 1000);
    };

    slider.max = String(sleepData.times.length - 1);
    slider.addEventListener("input", renderTime);
    playButton.addEventListener("click", () => {
        if (playbackTimer) {
            stopPlayback();
            return;
        }
        startPlayback();
    });
    renderTime();
}

const liveSpeedPage = document.querySelector(".live-speed-page");
if (liveSpeedPage) {
    const clientIp = liveSpeedPage.querySelector("#speedtestClientIp");
    const clientIsp = liveSpeedPage.querySelector("#speedtestClientIsp");
    const endpoint = "https://speed.cloudflare.com";

    const fetchWithCacheBust = (url, options = {}) => {
        const separator = url.includes("?") ? "&" : "?";
        return fetch(`${url}${separator}cacheBust=${Date.now()}-${Math.random().toString(16).slice(2)}`, {
            cache: "no-store",
            ...options,
        });
    };

    const parseCloudflareTrace = (text) => text
        .split("\n")
        .reduce((items, line) => {
            const [key, value] = line.split("=");
            if (key && value) {
                items[key.trim()] = value.trim();
            }
            return items;
        }, {});

    const loadJson = async (url) => {
        const response = await fetchWithCacheBust(url);
        if (!response.ok) {
            throw new Error("IP 資訊服務沒有回應。");
        }
        return response.json();
    };

    const applyClientInfo = (ip, isp) => {
        clientIp.textContent = ip || "無法取得";
        clientIsp.textContent = isp || "無法取得";
    };

    const loadClientInfo = async () => {
        try {
            const data = await loadJson("https://ipwho.is/");
            if (data.success === false) {
                throw new Error("ipwho.is 無法辨識此 IP。");
            }
            applyClientInfo(
                data.ip,
                data.connection?.isp || data.connection?.org || data.connection?.asn || data.org,
            );
        } catch (error) {
            try {
                const data = await loadJson("https://ipwhois.app/json/");
                applyClientInfo(data.ip, data.isp || data.org || data.asn);
            } catch (secondaryError) {
                try {
                    const data = await loadJson("https://ipapi.co/json/");
                    applyClientInfo(data.ip, data.org || data.asn);
                } catch (thirdError) {
                    try {
                        const response = await fetchWithCacheBust(`${endpoint}/cdn-cgi/trace`);
                        if (!response.ok) {
                            throw new Error("Cloudflare trace 沒有回應。");
                        }
                        const trace = parseCloudflareTrace(await response.text());
                        applyClientInfo(trace.ip, "");
                    } catch (fallbackError) {
                        applyClientInfo("", "");
                    }
                }
            }
        }
    };
    loadClientInfo();
}

const arfcnCalculator = document.querySelector("#arfcnCalculator");
if (arfcnCalculator) {
    const input = arfcnCalculator.querySelector("#arfcnInput");
    const result = arfcnCalculator.querySelector("#arfcnResult");
    const numberFormatter = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const nrArfcnRanges = [
        { min: 0, max: 599999, offsetMHz: 0, offsetArfcn: 0, stepMHz: 0.005, label: "0-3000 MHz" },
        { min: 600000, max: 2016666, offsetMHz: 3000, offsetArfcn: 600000, stepMHz: 0.015, label: "3000-24250 MHz" },
        { min: 2016667, max: 3279165, offsetMHz: 24250.08, offsetArfcn: 2016667, stepMHz: 0.06, label: "24250-100000 MHz" },
    ];

    const nrBands = [
        { band: "n1", ranges: [[1920, 1980], [2110, 2170]] },
        { band: "n2", ranges: [[1850, 1910], [1930, 1990]] },
        { band: "n3", ranges: [[1710, 1785], [1805, 1880]] },
        { band: "n5", ranges: [[824, 849], [869, 894]] },
        { band: "n7", ranges: [[2500, 2570], [2620, 2690]] },
        { band: "n8", ranges: [[880, 915], [925, 960]] },
        { band: "n12", ranges: [[699, 716], [729, 746]] },
        { band: "n13", ranges: [[777, 787], [746, 756]] },
        { band: "n14", ranges: [[788, 798], [758, 768]] },
        { band: "n18", ranges: [[815, 830], [860, 875]] },
        { band: "n20", ranges: [[832, 862], [791, 821]] },
        { band: "n24", ranges: [[1626.5, 1660.5], [1525, 1559]] },
        { band: "n25", ranges: [[1850, 1915], [1930, 1995]] },
        { band: "n26", ranges: [[814, 849], [859, 894]] },
        { band: "n28", ranges: [[703, 748], [758, 803]] },
        { band: "n29", ranges: [[717, 728]] },
        { band: "n30", ranges: [[2305, 2315], [2350, 2360]] },
        { band: "n34", ranges: [[2010, 2025]] },
        { band: "n38", ranges: [[2570, 2620]] },
        { band: "n39", ranges: [[1880, 1920]] },
        { band: "n40", ranges: [[2300, 2400]] },
        { band: "n41", ranges: [[2496, 2690]] },
        { band: "n46", ranges: [[5150, 5925]] },
        { band: "n48", ranges: [[3550, 3700]] },
        { band: "n50", ranges: [[1432, 1517]] },
        { band: "n51", ranges: [[1427, 1432]] },
        { band: "n53", ranges: [[2483.5, 2495]] },
        { band: "n54", ranges: [[1670, 1675]] },
        { band: "n65", ranges: [[1920, 2010], [2110, 2200]] },
        { band: "n66", ranges: [[1710, 1780], [2110, 2200]] },
        { band: "n67", ranges: [[738, 758]] },
        { band: "n70", ranges: [[1695, 1710], [1995, 2020]] },
        { band: "n71", ranges: [[663, 698], [617, 652]] },
        { band: "n74", ranges: [[1427, 1470], [1475, 1518]] },
        { band: "n75", ranges: [[1432, 1517]] },
        { band: "n76", ranges: [[1427, 1432]] },
        { band: "n77", ranges: [[3300, 4200]] },
        { band: "n78", ranges: [[3300, 3800]] },
        { band: "n79", ranges: [[4400, 5000]] },
        { band: "n80", ranges: [[1710, 1785]] },
        { band: "n81", ranges: [[880, 915]] },
        { band: "n82", ranges: [[832, 862]] },
        { band: "n83", ranges: [[703, 748]] },
        { band: "n84", ranges: [[1920, 1980]] },
        { band: "n85", ranges: [[698, 716], [728, 746]] },
        { band: "n86", ranges: [[1710, 1780]] },
        { band: "n89", ranges: [[824, 849]] },
        { band: "n90", ranges: [[2496, 2690]] },
        { band: "n91", ranges: [[832, 862], [1427, 1432]] },
        { band: "n92", ranges: [[832, 862], [1432, 1517]] },
        { band: "n93", ranges: [[880, 915], [1427, 1432]] },
        { band: "n94", ranges: [[880, 915], [1432, 1517]] },
        { band: "n95", ranges: [[2010, 2025]] },
        { band: "n96", ranges: [[5925, 7125]] },
        { band: "n97", ranges: [[2300, 2400]] },
        { band: "n98", ranges: [[1880, 1920]] },
        { band: "n99", ranges: [[1626.5, 1660.5]] },
        { band: "n100", ranges: [[874.4, 880], [919.4, 925]] },
        { band: "n101", ranges: [[1900, 1910]] },
        { band: "n102", ranges: [[5925, 6425]] },
        { band: "n104", ranges: [[6425, 7125]] },
        { band: "n257", ranges: [[26500, 29500]] },
        { band: "n258", ranges: [[24250, 27500]] },
        { band: "n259", ranges: [[39500, 43500]] },
        { band: "n260", ranges: [[37000, 40000]] },
        { band: "n261", ranges: [[27500, 28350]] },
    ];

    const preferredNrBands = ["n1", "n3", "n5", "n7", "n8", "n28", "n38", "n41", "n46", "n78", "n79"];

    const taiwanNrFrequencyHints = [
        { minMHz: 778, maxMHz: 783, includeMax: true, message: "似乎落在遠傳電信5G頻率內" },
        { minMHz: 950, maxMHz: 960, includeMax: true, message: "似乎落在中華電信的5G頻率內" },
        { minMHz: 2150, maxMHz: 2170, includeMax: true, message: "似乎落在中華電信的5G頻率內" },
        { minMHz: 2570, maxMHz: 2620, includeMax: true, message: "似乎落在遠傳電信5G頻率內" },
        { minMHz: 3300, maxMHz: 3340, message: "似乎落在台灣大哥大的5G頻率內" },
        { minMHz: 3340, maxMHz: 3420, message: "似乎落在遠傳電信5G頻率內" },
        { minMHz: 3420, maxMHz: 3510, message: "似乎落在中華電信的5G頻率內" },
        { minMHz: 3510, maxMHz: 3570, includeMax: true, message: "似乎落在台灣大哥大的5G頻率內" },
    ];

    const setResult = (message, state = "") => {
        result.textContent = message;
        result.classList.toggle("has-result", state === "result");
        result.classList.toggle("is-error", state === "error");
    };

    const calculateFrequency = (arfcn) => {
        const range = nrArfcnRanges.find((item) => arfcn >= item.min && arfcn <= item.max);
        if (!range) {
            return null;
        }

        return range.offsetMHz + (arfcn - range.offsetArfcn) * range.stepMHz;
    };

    const getNrBands = (frequencyMHz) => {
        const matches = nrBands
            .filter((band) => band.ranges.some(([minMHz, maxMHz]) => (
            frequencyMHz >= minMHz && frequencyMHz <= maxMHz
            )))
            .map((band) => band.band);
        const preferredMatches = preferredNrBands.filter((band) => matches.includes(band));
        if (preferredMatches.includes("n38")) {
            return preferredMatches.filter((band) => band === "n38" || band === "n41");
        }
        return preferredMatches.length ? preferredMatches : matches;
    };

    const getFrequencyHint = (frequencyMHz) => {
        const hint = taiwanNrFrequencyHints.find((item) => (
            frequencyMHz >= item.minMHz && (
                frequencyMHz < item.maxMHz || (item.includeMax && frequencyMHz <= item.maxMHz)
            )
        ));
        return hint ? hint.message : "";
    };

    arfcnCalculator.addEventListener("submit", (event) => {
        event.preventDefault();
        const rawValue = input.value.trim();
        const arfcn = Number(rawValue);

        if (!rawValue || !Number.isInteger(arfcn)) {
            setResult("請輸入整數 ARFCN。", "error");
            return;
        }

        const frequencyMHz = calculateFrequency(arfcn);
        if (frequencyMHz === null) {
            setResult("ARFCN 超出 3GPP NR-ARFCN 範圍。", "error");
            return;
        }

        const hint = getFrequencyHint(frequencyMHz);
        const bands = getNrBands(frequencyMHz);
        if (!bands.length) {
            setResult("輸入的數值可能有誤。", "error");
            return;
        }

        const bandText = bands.join(", ");
        setResult(`${numberFormatter.format(frequencyMHz)} MHz（${bandText}）${hint ? `，${hint}` : ""}`, "result");
    });

    input.addEventListener("input", () => {
        if (!input.value.trim()) {
            setResult("請輸入 ARFCN");
        }
    });
}
