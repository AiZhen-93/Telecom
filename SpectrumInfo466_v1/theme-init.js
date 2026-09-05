(function () {
    try {
        var saved = JSON.parse(window.localStorage.getItem("aizhenSitePreferences") || "{}");
        document.documentElement.dataset.theme = saved.theme === "light" ? "light" : "dark";
    } catch (_error) {
        document.documentElement.dataset.theme = "dark";
    }
}());
