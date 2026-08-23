document.addEventListener('DOMContentLoaded', () => {
    const clockElement = document.getElementById('clock');
    const searchInput = document.getElementById('search-input');

    // Update Clock
    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();

        hours = hours < 10 ? '0' + hours.toString() : hours.toString();
        minutes = minutes < 10 ? '0' + minutes.toString() : minutes.toString();

        if (clockElement) clockElement.textContent = `${hours}:${minutes}`;
    }

    updateClock();
    setInterval(updateClock, 1000);

    function navigateTo(url) {
        if (window.aegisAPI && typeof window.aegisAPI.navigateCurrent === 'function') {
            window.aegisAPI.navigateCurrent(url);
        } else {
            window.location.href = url;
        }
    }

    // Handle Search & Navigation
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (!query) return;

                const isUrl = /^(https?:\/\/|about:|aegis:|zenith:|file:\/\/)/i.test(query) ||
                              (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(query) && !query.includes(' '));
                
                if (isUrl) {
                    let url = query;
                    if (!/^(https?:\/\/|about:|aegis:|zenith:|file:\/\/)/i.test(url)) {
                        url = 'https://' + url;
                    }
                    navigateTo(url);
                } else {
                    navigateTo(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
                }
            }
        });
    }

    // Intercept link clicks to ensure smooth local navigation
    document.querySelectorAll('.link-item').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href) {
                e.preventDefault();
                navigateTo(href);
            }
        });
    });
});
