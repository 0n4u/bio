document.addEventListener("DOMContentLoaded", function () {
  const titleElement = document.querySelector("title");
  const ipAddressElement = document.getElementById("ip-address");
  const countryElement = document.getElementById("country");
  const locationElement = document.getElementById("location");
  const ispElement = document.getElementById("isp");
  const timeElement = document.getElementById("time");
  const deviceInfoElement = document.getElementById("device-info");
  const titles = " overdose ";
  let index = 0;
  const delay = 200;
  const updateTitle = () => {
    titleElement.textContent = titles.substring(index) + titles.substring(0, index);
    index = (index + 1) % titles.length;
  };
  const updateTime = () => {
    try {
      const now = new Date();
      const timeOptions = {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      };
      const dateOptions = {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      };
      const timeString = now.toLocaleTimeString("th-TH", timeOptions);
      const dateString = now.toLocaleDateString("th-TH", dateOptions).replace(/\//g, "/");
      timeElement.textContent = `Date & Time: ${dateString} ${timeString}`;
    } catch (error) {}
  };
  const getIPAddress = async () => {
    try {
      const response = await fetch("https://api.ipdata.co/?api-key=8701de3ac942a16e52762033f240682911128f1d6a0a2e31cc70bbb9");
      const data = await response.json();
      ipAddressElement.textContent = `IP Address: ${data.ip}`;
      countryElement.innerHTML = `Country: ${data.country_name} <img id="flag" src="https://flagcdn.com/24x18/${data.country_code.toLowerCase()}.png" alt="${data.country_name} Flag">`;
      locationElement.textContent = `Location: ${data.city}, ${data.region}`;
      ispElement.textContent = `Provider: ${data.asn.name}`;
    } catch (error) {
      ipAddressElement.textContent = "IP Address: Unable to retrieve data.";
      countryElement.textContent = "Country: Unknown";
      locationElement.textContent = "Location: Unknown";
      ispElement.textContent = "Provider: Unknown";
    }
  };
  const getDeviceInfo = () => {
    try {
      const userAgent = navigator.userAgent.toLowerCase();
      let deviceType = "Unknown Device";
      let browserType = "Unknown Browser";
      if (/iphone/i.test(userAgent)) {
        deviceType = "iPhone";
      } else if (/ipad/i.test(userAgent)) {
        deviceType = "iPad";
      } else if (/android/i.test(userAgent)) {
        deviceType = /mobile/i.test(userAgent) ? "Android Phone" : "Android Tablet";
      } else if (/windows/i.test(userAgent)) {
        deviceType = "Windows PC";
      } else if (/macintosh|mac os x/i.test(userAgent)) {
        deviceType = "Macintosh";
      } else {
        deviceType = "Desktop";
      }
      if (/chrome|edg/i.test(userAgent)) {
        browserType = "Google Chrome";
      } else if (/safari/i.test(userAgent)) {
        browserType = "Safari";
      } else if (/firefox/i.test(userAgent)) {
        browserType = "Mozilla Firefox";
      } else if (/edge/i.test(userAgent)) {
        browserType = "Microsoft Edge";
      } else if (/opera|opr/i.test(userAgent)) {
        browserType = "Opera";
      } else if (/msie|trident/i.test(userAgent)) {
        browserType = "Internet Explorer";
      }
      deviceInfoElement.textContent = `Device: ${deviceType} | Browser: ${browserType}`;
    } catch (error) {
      deviceInfoElement.textContent = "Device: Unknown | Browser: Unknown";
    }
  };
  getIPAddress();
  getDeviceInfo();
  updateTime();
  setInterval(updateTitle, delay);
  setInterval(updateTime, 1000);
});