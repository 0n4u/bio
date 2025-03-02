document.addEventListener("DOMContentLoaded", function () {
    let titles = " overdose ";
    let titleElement = document.querySelector('title');
    let index = 0;
    let delay = 200;
    let updateTitle = function () {
        titleElement.textContent = titles.substring(index) + titles.substring(0, index);
        index = (index + 1) % titles.length;
    };
    setInterval(updateTitle, delay);
});

function getIPAddress() {
    fetch('https://api.ipdata.co/?api-key=8701de3ac942a16e52762033f240682911128f1d6a0a2e31cc70bbb9').then(response => response.json()).then(data => {
        document.getElementById('ip-address').textContent = 'IP Address: ' + data.ip;
        document.getElementById('country').innerHTML = 'Country: ' + data.country_name + `<img id="flag" src="https://flagcdn.com/24x18/${
            data.country_code.toLowerCase()
        }.png" alt="${
            data.country_name
        } Flag">`;
        document.getElementById('location').textContent = 'Location: ' + data.city + ', ' + data.region;
        document.getElementById('isp').textContent = 'Provider: ' + data.asn.name;
    });
}

function updateTime() {
    const now = new Date();
    const timeOptions = {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const dateOptions = {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };

    const timeString = now.toLocaleTimeString('th-TH', timeOptions);
    const dateString = now.toLocaleDateString('th-TH', dateOptions).replace(/\//g, '/');

    document.getElementById('time').textContent = 'Date & Time: ' + dateString + ' ' + timeString;
}

function getDeviceInfo() {
    const userAgent = navigator.userAgent.toLowerCase();
    let deviceType = "-";
    let browserType = "-";

    if (/iphone/i.test(userAgent)) {
        deviceType = "iPhone";
    } else if (/ipad/i.test(userAgent)) {
        deviceType = "iPad";
    } else if (/android/i.test(userAgent)) {
        if (/mobile/i.test(userAgent)) {
            deviceType = "Android Phone";
        } else {
            deviceType = "Android Tablet";
        }
    } else if (/windows/i.test(userAgent)) {
        deviceType = "Windows PC";
    } else if (/macintosh|mac os x/i.test(userAgent)) {
        deviceType = "Macintosh";
    } else {
        deviceType = "Desktop";
    }

    if (userAgent.includes('chrome')) {
        browserType = 'Google Chrome';
    } else if (userAgent.includes('safari')) {
        browserType = 'Safari';
    } else if (userAgent.includes('firefox')) {
        browserType = 'Mozilla Firefox';
    } else if (userAgent.includes('edge')) {
        browserType = 'Microsoft Edge';
    } else if (userAgent.includes('opera') || userAgent.includes('opr')) {
        browserType = 'Opera';
    } else if (userAgent.includes('msie') || userAgent.includes('trident')) {
        browserType = 'Internet Explorer';
    }

    const deviceInfo = `Device: ${deviceType} | Browser: ${browserType}`;
    if (deviceType && browserType) {
        document.getElementById('device-info').textContent = deviceInfo;
    }
}

window.onload = function () {
    getIPAddress();
    updateTime();
    getDeviceInfo();
    setInterval(updateTime, 1000); // Updated to 1000ms for realistic update interval
};
