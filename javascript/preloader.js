const preloader = document.getElementById("page-preloader");

if (preloader) {
    let pageLoaded = document.readyState === "complete";
    let appDataReady = !document.querySelector(".dashboard");
    let removed = false;

    const bodyVisibilityObserver = new MutationObserver(hidePreloaderWhenReady);

    function hidePreloaderWhenReady() {
        if (
            removed ||
            !pageLoaded ||
            !appDataReady ||
            getComputedStyle(document.body).visibility === "hidden"
        ) {
            return;
        }

        removed = true;
        bodyVisibilityObserver.disconnect();
        preloader.classList.add("page-preloader--hidden");
        window.setTimeout(() => preloader.remove(), 500);
    }

    bodyVisibilityObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["style"]
    });

    window.addEventListener("load", () => {
        pageLoaded = true;
        hidePreloaderWhenReady();
    }, { once: true });

    window.addEventListener("app:initial-data-ready", () => {
        appDataReady = true;
        hidePreloaderWhenReady();
    }, { once: true });

    if (pageLoaded) {
        hidePreloaderWhenReady();
    }
}
