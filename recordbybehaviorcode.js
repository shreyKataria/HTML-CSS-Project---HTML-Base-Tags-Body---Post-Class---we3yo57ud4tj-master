(function () {
  let eventsArray = [];
  let errorsArray = [];
  let fetchDetailsArray = [];
  let pageLoadData = [];
  let consoleData = [];
  let observer;
  let metricsInterval;
  let sessionData = {
    userId: Math.floor(Math.random() * 90 + 10),
    startTime: new Date().toISOString(),
    ipAddress: null,
    browser: navigator.userAgent,
    device: null,
    endTime: null,
    location: null,
    country: null,
    totalScrollableHeight: null,
    isMobile: false,
    screenOrientation: null,
    touchPoints: navigator.maxTouchPoints || 0,
    networkType: null,
    batteryLevel: null,
    isCharging: null,
    errorCount: 0,
    eventsCount: 0,
  };

  let performanceMetrics = {
    cpuUsage: [],
    longTasks: [],
    networkSpeeds: [],
    memoryUsage: [],
    cumulativeLayoutShifts: [],
    crashes: [],
  };

  let classCounter = 0;
  let lastMouseMoveEvent = null;
  let lastTouchMoveEvent = null;
  let inactivityTimeout = null;
  let breakTimeout = null;
  const inactivityPeriod = 20000;
  const breakPeriod = 150000;
  let breakStart = null;

  // Variables for rage clicks and dead clicks
  let clickHistory = [];
  const RAGE_CLICK_THRESHOLD = 3;
  const RAGE_CLICK_INTERVAL = 500; // 500ms
  const DEAD_CLICK_TIMEOUT = 5000; // 5000ms

  function getCurrentURL() {
    return window.location.href;
  }

  function generateUniqueClassName() {
    return `randomElem_${classCounter++}`;
  }

  function assignUniqueClasses(rootElement = document.body) {
    const elements = rootElement.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (
        !Array.from(element.classList).some((cls) =>
          cls.startsWith("randomElem_")
        )
      ) {
        element.classList.add(generateUniqueClassName());
      }
    }
  }

  function getScrollableHeight() {
    sessionData.totalScrollableHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
  }

  async function getSessionIP() {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      console.log("Data of ip:", data);
      sessionData.ipAddress = data.ip;
    } catch (error) {
      logError(error, { type: "IPFetchError" });
    }
  }

  async function getCountry(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.address) {
        return data.address.country || "Unknown Country";
      } else {
        return "Unknown Country";
      }
    } catch (error) {
      console.error("Error fetching country name:", error);
      return "Unknown Country";
    }
  }

  async function getGeolocation() {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log("Geolocation position:", position);
        sessionData.location = `${position.coords.latitude},${position.coords.longitude}`;
        sessionData.country = await getCountry(
          position.coords.latitude,
          position.coords.longitude
        );
        console.log("Country:", sessionData.country);
      },
      (error) => {
        logError(error, { type: "GeolocationError" });
      }
    );
  }

  function detectMobile() {
    sessionData.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera 	Mini/i.test(
        navigator.userAgent
      );
  }

  function getScreenOrientation() {
    sessionData.screenOrientation = screen.orientation
      ? screen.orientation.type
      : window.orientation;
  }

  function getNetworkType() {
    if (navigator.connection) {
      sessionData.networkType = navigator.connection.effectiveType;
    }
  }

  function collectResourceTimings() {
    const resources = performance.getEntriesByType("resource");
    return resources.map((resource) => ({
      name: resource.name,
      initiatorType: resource.initiatorType,
      startTime: Math.round(resource.startTime),
      duration: Math.round(resource.duration),
      transferSize: resource.transferSize,
      encodedBodySize: resource.encodedBodySize,
      decodedBodySize: resource.decodedBodySize,
      status: inferResourceStatus(resource),
    }));
  }

  function inferResourceStatus(resource) {
    // If transferSize is 0 and encodedBodySize is > 0, it's likely a 304 Not Modified
    if (resource.transferSize === 0 && resource.encodedBodySize > 0) {
      return "304 Not Modified";
    }
    // If transferSize is 0 and encodedBodySize is 0, it might be an error or canceled request
    else if (resource.transferSize === 0 && resource.encodedBodySize === 0) {
      return "404 Possible Error";
    }
    // Otherwise, assume it's a successful request
    else {
      return "200 OK";
    }
  }

  const resourceStatusMap = new Map();

  const observer1 = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.entryType === "resource") {
        const status = entry.responseStatus;
        resourceStatusMap.set(entry.name, status);
      }
    });
  });

  observer1.observe({ entryTypes: ["resource"] });

  function collectResourceTimings() {
    const resources = performance.getEntriesByType("resource");
    return resources.map((resource) => ({
      name: resource.name,
      initiatorType: resource.initiatorType,
      startTime: Math.round(resource.startTime),
      duration: Math.round(resource.duration),
      transferSize: resource.transferSize,
      encodedBodySize: resource.encodedBodySize,
      decodedBodySize: resource.decodedBodySize,
      status:
        resourceStatusMap.get(resource.name) || inferResourceStatus(resource),
    }));
  }
  async function getBatteryInfo() {
    if ("getBattery" in navigator) {
      try {
        const battery = await navigator.getBattery();
        sessionData.batteryLevel = battery.level;
        sessionData.isCharging = battery.charging;

        battery.addEventListener("levelchange", () => {
          sessionData.batteryLevel = battery.level;
        });

        battery.addEventListener("chargingchange", () => {
          sessionData.isCharging = battery.charging;
        });
      } catch (error) {
        logError(error, { type: "BatteryInfoError" });
      }
    }
  }

  async function consolfunction() {
    // Utility function to get current URL
    const getCurrentURL = () => window.location.href;

    // Capture Console Logs (log, info, warn, error, debug)
    const captureConsole = (method, type) => {
      const originalMethod = console[method];
      console[method] = function (...args) {
        consoleData.push({
          type: type,
          time: Date.now(),
          url: getCurrentURL(),
          data: args,
        });
        originalMethod.apply(console, args);
      };
    };

    // Capture all console types
    captureConsole("log", "log");
    captureConsole("info", "info");
    captureConsole("warn", "warning");
    captureConsole("error", "error");
    captureConsole("debug", "debug");

    // Capture Network Requests (fetch)
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const [resource, config] = args;
      const startTime = new Date().getTime();
      const response = await originalFetch(...args);
      const endTime = new Date().getTime();

      consoleData.push({
        type: "network",
        time: endTime,
        url: getCurrentURL(),
        duration: endTime - startTime,
        data: resource,
        status: response.status,
      });

      return response;
    };

    // Redux Middleware to capture state and actions
    const reduxLoggerMiddleware = (store) => (next) => (action) => {
      const result = next(action);
      consoleData.push({
        type: "redux",
        time: Date.now(),
        url: getCurrentURL(),
        action: action,
        data: store.getState(),
      });
      return result;
    };

    const store = createStore(
        rootReducer,
        applyMiddleware(reduxLoggerMiddleware) // Apply the logger middleware
      );

    // Apply the Redux middleware to your store like this:
    // const store = createStore(rootReducer, applyMiddleware(reduxLoggerMiddleware));

    // Capture Navigation Events
    const captureNavigationEvent = (eventType, event) => {
      const newHTML = document.documentElement.outerHTML; // Capture the current HTML state
      consoleData.push({
        type: "navigation",
        html: newHTML,
        time: Date.now(),
        url: getCurrentURL(),
        data: event ? event.state : null,
      });
    };

    // Capture page load events
    window.addEventListener("load", (event) => {
      captureNavigationEvent("load", event);
    });

    // Capture history navigation (pushState, replaceState)
    const captureHistory = (method) => {
      const originalMethod = history[method];
      history[method] = function (...args) {
        const event = { state: args[0] }; // Capture state from pushState/replaceState
        const url = args[2]; // URL is the third argument
        originalMethod.apply(history, args);
        captureNavigationEvent(method, event);
      };
    };

    captureHistory("pushState");
    captureHistory("replaceState");

    // Capture popstate events (back/forward navigation)
    window.addEventListener("popstate", (event) => {
      captureNavigationEvent("popstate", event);
    });
  };

  function startRecording() {
    eventsArray = [];
    sessionData.startTime = new Date().toISOString();

    if (navigator.userAgentData) {
      sessionData.device = navigator.userAgentData.platform;
    } else {
      sessionData.device = navigator.platform;
    }

    detectMobile();
    getScrollableHeight();
    getScreenOrientation();
    getNetworkType();
    getBatteryInfo();
    consolfunction(); 

    

    getSessionIP().then(() => {
      getGeolocation();
      assignUniqueClasses(document.documentElement);
      const initialHTML = document.documentElement.outerHTML;
      const baseHref = document.querySelector("base")?.href || document.baseURI;
      console.log("baseHref",baseHref)
      const images = Array.from(document.querySelectorAll("img")).map(
        (img) => ({
          src: new URL(img.src, baseHref).href,
          path: getPath(img),
        })
      );

      const stylesheets = Array.from(document.styleSheets)
        .map((styleSheet) => {
          try {
            return {
              href: styleSheet.href
                ? new URL(styleSheet.href, baseHref).href
                : null,
              rules: Array.from(styleSheet.cssRules).map(
                (rule) => rule.cssText
              ),
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const inlineStyles = Array.from(document.querySelectorAll("style")).map(
        (styleElement) => ({
          content: styleElement.textContent,
          path: getPath(styleElement),
        })
      );

      const scripts = Array.from(document.scripts).map((script) => ({
        src: script.src ? new URL(script.src, baseHref).href : null,
        content: script.src ? null : script.text,
        path: getPath(script),
      }));

      const inlineScripts = Array.from(document.querySelectorAll("script"))
        .filter((script) => !script.src)
        .map((script) => ({
          content: script.text,
          path: getPath(script),
        }));

      eventsArray.push({
        type: "initial",
        html: initialHTML,
        time: Date.now(),
        url: getCurrentURL(),
        baseHref: baseHref,
        images: images,
        stylesheets: stylesheets,
        inlineStyles: inlineStyles,
        scripts: scripts,
        inlineScripts: inlineScripts,
      });

      recordPageLoadMetrics();
      startPeriodicMetricsCollection();
      observeLongTasks();
      observeLayoutShifts();
      detectCrashes();

      observer = new MutationObserver(handleMutations);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        characterDataOldValue: true,
      });

      addEventListeners();
      window.addEventListener("popstate", handlePopState);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    });
  }

  function startPeriodicMetricsCollection() {
    metricsInterval = setInterval(collectMetrics, 5000); // Collect metrics every 5 seconds
  }

  function collectMetrics() {
    collectCPUUsage();
    collectMemoryUsage();
    collectNetworkSpeed();
  }

  function collectCPUUsage() {
    if (window.performance && performance.now) {
      const startTime = performance.now();
      const iterations = 1000000;
      for (let i = 0; i < iterations; i++) {
        // Dummy operation to measure CPU usage
        Math.sqrt(i);
      }
      const endTime = performance.now();
      const cpuUsage = (endTime - startTime) / iterations;
      performanceMetrics.cpuUsage.push({ time: Date.now(), usage: cpuUsage });
    }
  }

  function collectMemoryUsage() {
    if (performance.memory) {
      performanceMetrics.memoryUsage.push({
        time: Date.now(),
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
      });
    }
  }

  function collectNetworkSpeed() {
    const imageUrl =
      "https://upload.wikimedia.org/wikipedia/commons/3/3f/Placeholder_view_vector.svg";
    const startTime = Date.now();
    fetch(imageUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const endTime = Date.now();
        const fileSize = blob.size;
        const durationInSeconds = (endTime - startTime) / 1000;
        const speedMbps = (fileSize * 8) / (1000000 * durationInSeconds);

        // Store the network speed with timestamp
        performanceMetrics.networkSpeeds.push({
          time: Date.now(),
          speed: speedMbps,
          unit: "Mbps",
        });

        // If the speed is less than 1 Mbps, convert to Kbps for better readability
        if (speedMbps < 1) {
          const speedKbps = speedMbps * 1000;
          performanceMetrics.networkSpeeds[
            performanceMetrics.networkSpeeds.length - 1
          ].speed = speedKbps;
          performanceMetrics.networkSpeeds[
            performanceMetrics.networkSpeeds.length - 1
          ].unit = "Kbps";
        }

        console.log(
          `Network speed at ${new Date().toISOString()}: ${performanceMetrics.networkSpeeds[
            performanceMetrics.networkSpeeds.length - 1
          ].speed.toFixed(2)} ${
            performanceMetrics.networkSpeeds[
              performanceMetrics.networkSpeeds.length - 1
            ].unit
          }`
        );
      })
      .catch((error) =>
        logError(error, { type: "NetworkSpeedMeasurementError" })
      );
  }

  let longTasksObserver;
  function observeLongTasks() {
    if ("PerformanceObserver" in window) {
      longTasksObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          performanceMetrics.longTasks.push({
            time: Date.now(),
            duration: entry.duration,
          });
        }
      });
      longTasksObserver.observe({ entryTypes: ["longtask"] });
    }
  }

  function stopLongTasksObserver() {
    if (longTasksObserver) {
      longTasksObserver.disconnect();
    }
  }

  let layoutShiftsObserver;
  function observeLayoutShifts() {
    if ("PerformanceObserver" in window) {
      layoutShiftsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          performanceMetrics.cumulativeLayoutShifts.push({
            time: Date.now(),
            value: entry.value,
          });
        }
      });
      layoutShiftsObserver.observe({ type: "layout-shift", buffered: true });
    }
  }

  function stopLayoutShiftsObserver() {
    if (layoutShiftsObserver) {
      layoutShiftsObserver.disconnect();
    }
  }

  function detectCrashes() {
    window.addEventListener("error", function (event) {
      performanceMetrics.crashes.push({
        time: Date.now(),
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
  }

  function stopRecording() {
    if (observer) observer.disconnect();
    if (metricsInterval) clearInterval(metricsInterval);
    clearTimersAndIntervals();
    sessionData.endTime = new Date().toISOString();
    removeEventListeners();
    window.removeEventListener("popstate", handlePopState);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    stopLongTasksObserver();
    stopLayoutShiftsObserver();
  }

  function handlePopState(event) {
    try {
      const newHTML = document.documentElement.outerHTML;
      eventsArray.push({
        type: "navigation",
        html: newHTML,
        time: Date.now(),
        url: getCurrentURL(),
        state: event.state,
      });
    } catch (error) {
      logError(error, { type: "PopStateEventError" });
    }
  }

  function handleMutations(mutations) {
    mutations.forEach((mutation) => {
      try {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              assignUniqueClasses(node);
            }
          });
        }

        const mutationData = {
          type: "mutation",
          time: Date.now(),
          url: getCurrentURL(),
          mutationType: mutation.type,
          target: getPath(mutation.target),
          addedNodes: Array.from(mutation.addedNodes).map(
            (node) => node.outerHTML
          ),
          removedNodes: Array.from(mutation.removedNodes).map(
            (node) => node.outerHTML
          ),
          attributeName: mutation.attributeName,
          oldValue: mutation.oldValue,
          newValue: mutation.target.getAttribute(mutation.attributeName),
        };

        if (
          mutation.attributeName === "src" &&
          mutation.target.tagName === "IMG"
        ) {
          mutationData.src = mutation.target.src;
        }
        eventsArray.push(mutationData);
      } catch (error) {
        logError(error, { type: "MutationObserverError" });
      }
    });
  }

  // Monitor mouse/touch inactivity and session breaking
  function startActivityMonitoring() {
    if (sessionData.isMobile) {
      document.addEventListener("touchmove", resetInactivityTimer);
    } else {
      document.addEventListener("mousemove", resetInactivityTimer);
    }
    resetInactivityTimer(); // Initialize the timer
  }

  function resetInactivityTimer(event) {
    if (inactivityTimeout) {
      clearTimeout(inactivityTimeout);
    }
    if (breakTimeout) {
      clearTimeout(breakTimeout);
    }
    inactivityTimeout = setTimeout(startBreakTimer, inactivityPeriod);

    if (sessionData.isMobile) {
      lastTouchMoveEvent = event;
    } else {
      lastMouseMoveEvent = {
        x: window.pageXOffset,
        y: window.pageYOffset,
      };
    }
  }

  function startBreakTimer() {
    console.log("Inactivity detected. Starting 2.5 min timer.");
    breakStart = Date.now();
    breakTimeout = setTimeout(endSessionDueToInactivity, breakPeriod);
  }

  function endSessionDueToInactivity() {
    console.log("Session break due to inactivity.");
    const currentTime = Date.now();
    eventsArray = eventsArray.filter(
      (event) => currentTime - event.time > breakPeriod
    );
    saveEventsToServer({ reason: "Due to inactivity" });
    stopRecording();
  }

  function addEventListeners() {
    window.addEventListener("scroll", recordScroll, true);
    window.addEventListener("popstate", recordNavigation, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", recordKeydown, true);
    document.addEventListener("input", recordInput, true);
    document.addEventListener("submit", recordSubmit, true);

    if (sessionData.isMobile) {
      document.addEventListener("touchstart", recordTouch, true);
      document.addEventListener("touchmove", recordTouch, true);
      document.addEventListener("touchend", recordTouch, true);
    } else {
      document.addEventListener("mousemove", recordMousemove, true);
    }

    startActivityMonitoring();

    // Mobile-specific listeners
    if (sessionData.isMobile) {
      window.addEventListener(
        "orientationchange",
        handleOrientationChange,
        true
      );
    }
  }

  function removeEventListeners() {
    window.removeEventListener("scroll", recordScroll, true);
    window.removeEventListener("popstate", recordNavigation, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", recordKeydown, true);
    document.removeEventListener("input", recordInput, true);
    document.removeEventListener("submit", recordSubmit, true);

    if (sessionData.isMobile) {
      document.removeEventListener("touchstart", recordTouch, true);
      document.removeEventListener("touchmove", recordTouch, true);
      document.removeEventListener("touchend", recordTouch, true);
      document.removeEventListener("touchmove", resetInactivityTimer);
      window.removeEventListener(
        "orientationchange",
        handleOrientationChange,
        true
      );
    } else {
      document.removeEventListener("mousemove", recordMousemove, true);
      document.removeEventListener("mousemove", resetInactivityTimer);
    }
  }

  function incrementEventsCount() {
    sessionData.eventsCount++;
  }

  // function recordEvent(
  //     type,
  //     pageX,
  //     pageY,
  //     path,
  //     value,
  //     key,
  //     eventTarget = null,
  //     eventProps = {}
  // ) {
  //     const eventObj = {
  //         type,
  //         time: Date.now(),
  //         url: getCurrentURL(),
  //         pageX,
  //         pageY,
  //         path,
  //         value,
  //         key,
  //         eventProps,
  //         attributes: {},
  //     };

  //     if (eventTarget) {
  //         const targetElement = path ? document.querySelector(path) : eventTarget;
  //         if (targetElement && targetElement.attributes) {
  //             Array.from(targetElement.attributes).forEach((attr) => {
  //                 eventObj.attributes[attr.name] = attr.value;
  //             });

  //             eventObj.attributes.tagName = targetElement.tagName;

  //             if (targetElement.alt) {
  //                 eventObj.attributes.alt = targetElement.alt;
  //             }

  //             if (targetElement.value) {
  //                 eventObj.attributes.value = targetElement.value;
  //             }

  //             if (targetElement.innerText) {
  //                 eventObj.attributes.innerText = targetElement.innerText;
  //             }

  //             if (targetElement.name) {
  //                 eventObj.attributes.name = targetElement.name;
  //             }
  //             if (targetElement.placeholder) {
  //                 eventObj.attributes.placeholder = targetElement.placeholder;
  //             }
  //         }
  //     }

  //     // Increment events count for interaction-related events
  //     const interactionEvents = ['click', 'scroll', 'input', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'keydown', 'submit'];
  //     if (interactionEvents.includes(type)) {
  //         incrementEventsCount();
  //     }

  //     eventsArray.push(eventObj);
  // }

  function recordEvent(
    type,
    pageX,
    pageY,
    path,
    value,
    key,
    eventTarget = null,
    eventProps = {}
  ) {
    const eventObj = {
      type,
      time: Date.now(),
      url: getCurrentURL(),
      pageX,
      pageY,
      path,
      value,
      key,
      eventProps,
      attributes: {},
    };

    if (eventTarget) {
      const targetElement = path ? document.querySelector(path) : eventTarget;
      if (targetElement && targetElement.attributes) {
        Array.from(targetElement.attributes).forEach((attr) => {
          eventObj.attributes[attr.name] = attr.value;
        });

        eventObj.attributes.tagName = targetElement.tagName;

        if (targetElement.alt) {
          eventObj.attributes.alt = targetElement.alt;
        }

        if (targetElement.value) {
          eventObj.attributes.value = targetElement.value;
        }

        if (targetElement.innerText) {
          eventObj.attributes.innerText = targetElement.innerText;
        }

        if (targetElement.name) {
          eventObj.attributes.name = targetElement.name;
        }
        if (targetElement.placeholder) {
          eventObj.attributes.placeholder = targetElement.placeholder;
        }
      }
    }

    // Increment events count for interaction-related events
    const interactionEvents = [
      "click",
      "scroll",
      "input",
      "mousemove",
      "touchstart",
      "touchmove",
      "touchend",
      "keydown",
      "submit",
    ];
    if (interactionEvents.includes(type)) {
      incrementEventsCount();
    }

    eventsArray.push(eventObj);
  }

  function handleClick(event) {
    const clickTime = Date.now();
    const clickLocation = `${event.clientX},${event.clientY}`;

    // Record the click
    clickHistory.push({ time: clickTime, location: clickLocation });

    // Check for rage clicks
    if (checkRageClick(clickTime, clickLocation, event)) {
      // If it's a rage click, don't check for dead click
      return;
    }

    // Check for dead clicks
    checkDeadClick(event.target, event);

    // Existing click recording logic
    recordClick(event);
  }

  function checkRageClick(clickTime, clickLocation, event) {
    const recentClicks = clickHistory.filter(
      (click) =>
        click.time > clickTime - RAGE_CLICK_INTERVAL &&
        click.location === clickLocation
    );

    if (recentClicks.length >= RAGE_CLICK_THRESHOLD) {
      recordEvent(
        "rageClick",
        event.pageX,
        event.pageY,
        getPath(event.target),
        null,
        null,
        event.target,
        { clickCount: recentClicks.length }
      );
      console.log("Rage click detected:", recentClicks.length, "clicks");
      return true;
    }

    // Remove old clicks from history
    clickHistory = clickHistory.filter(
      (click) => click.time > clickTime - RAGE_CLICK_INTERVAL
    );
    return false;
  }

  function isClickable(element) {
    const clickableTags = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"];
    return (
      clickableTags.includes(element.tagName) ||
      element.onclick != null ||
      element.getAttribute("role") === "button" ||
      window.getComputedStyle(element).cursor === "pointer"
    );
  }

  function isAncestorClickable(element) {
    while (element && element !== document.body) {
      if (isClickable(element)) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  }

  function checkDeadClick(target, event) {
    if (!isClickable(target) && !isAncestorClickable(target)) {
      return; // Not a potentially interactive element, so ignore
    }

    const initialUrl = getCurrentURL();
    const initialState = history.state;
    setTimeout(() => {
      if (initialUrl === getCurrentURL() && initialState === history.state) {
        recordEvent(
          "deadClick",
          event.pageX,
          event.pageY,
          getPath(target),
          null,
          null,
          target
        );
        console.log("Dead click detected");
      }
    }, DEAD_CLICK_TIMEOUT);
  }

  function recordClick(event) {
    try {
      const eventProps = {
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        button: event.button,
        buttons: event.buttons,
      };

      recordEvent(
        "click",
        event.pageX,
        event.pageY,
        getPath(event.target),
        null,
        null,
        event.target,
        eventProps
      );
    } catch (error) {
      logError(error, { type: "ClickEventError" });
    }
  }

  function recordInput(event) {
    try {
      const eventProps = {
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        data: event.data,
        inputType: event.inputType,
        isComposing: event.isComposing,
        composed: event.composed,
        detail: event.detail,
      };

      recordEvent(
        "input",
        null,
        null,
        getPath(event.target),
        event.target.value,
        null,
        event.target,
        eventProps
      );
    } catch (error) {
      logError(error, { type: "InputEventError" });
    }
  }

  function recordMousemove(event) {
    try {
      lastMouseMoveEvent = event; // Store last mouse move event for inactivity tracking

      const eventProps = {
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        button: event.button,
        buttons: event.buttons,
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        composed: event.composed,
      };

      recordEvent(
        "mousemove",
        event.pageX,
        event.pageY,
        null,
        null,
        null,
        event.target,
        eventProps
      );
    } catch (error) {
      logError(error, { type: "MousemoveEventError" });
    }
  }

  function recordTouch(event) {
    try {
      const touch = event.touches[0] || event.changedTouches[0];
      const eventProps = {
        screenX: touch.screenX,
        screenY: touch.screenY,
        clientX: touch.clientX,
        clientY: touch.clientY,
        pageX: touch.pageX,
        pageY: touch.pageY,
        radiusX: touch.radiusX,
        radiusY: touch.radiusY,
        rotationAngle: touch.rotationAngle,
        force: touch.force,
        identifier: touch.identifier,
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        composed: event.composed,
      };

      recordEvent(
        event.type,
        touch.pageX,
        touch.pageY,
        getPath(event.target),
        null,
        null,
        event.target,
        eventProps
      );
    } catch (error) {
      logError(error, { type: "TouchEventError" });
    }
  }

  function recordScroll(event) {
    try {
      recordEvent("scroll", window.scrollX, window.scrollY, null, null, null);
    } catch (error) {
      logError(error, { type: "ScrollEventError" });
    }
  }

  function recordKeydown(event) {
    try {
      const eventProps = {
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        charCode: event.charCode,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
      };

      recordEvent(
        "keydown",
        null,
        null,
        getPath(event.target),
        null,
        event.key,
        event.target,
        eventProps
      );
    } catch (error) {
      logError(error, { type: "KeydownEventError" });
    }
  }

  function recordSubmit(event) {
    try {
      recordEvent(
        "submit",
        null,
        null,
        getPath(event.target),
        null,
        null,
        event.target
      );
      event.preventDefault();
    } catch (error) {
      logError(error, { type: "SubmitEventError" });
    }
  }

  function recordNavigation(event) {
    try {
      recordEvent("navigation", null, null, null, null, null, null, {
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        state: JSON.stringify(event.state),
      });
    } catch (error) {
      logError(error, { type: "NavigationEventError" });
    }
  }

  function handleOrientationChange(event) {
    try {
      getScreenOrientation();
      recordEvent("orientationchange", null, null, null, null, null, null, {
        orientation: sessionData.screenOrientation,
      });
    } catch (error) {
      logError(error, { type: "OrientationChangeError" });
    }
  }

  function saveEventsToServer(reason) {
    sessionData.endTime = new Date().toISOString();
    const payload = {
      User_id: sessionData.userId,
      Start_time: sessionData.startTime,
      Ip_address: sessionData.ipAddress,
      Browser: sessionData.browser,
      Device: sessionData.device,
      End_time: sessionData.endTime,
      Location: sessionData.location,
      Country: sessionData.country,
      totalHeight: sessionData.totalScrollableHeight,
      eventData: eventsArray,
      consoleData:consoleData,
      errorData: errorsArray,
      fetchData: fetchDetailsArray,
      reason: reason.reason,
      performanceMetrics: performanceMetrics,
      pageLoadData: pageLoadData,
      isMobile: sessionData.isMobile,
      screenOrientation: sessionData.screenOrientation,
      touchPoints: sessionData.touchPoints,
      networkType: sessionData.networkType,
      batteryLevel: sessionData.batteryLevel,
      isCharging: sessionData.isCharging,
      errorCount: sessionData.errorCount,
      eventsCount: sessionData.eventsCount,
    };
    // const fetchUrl = "https://behaviourcode.alnakiya.com/postdata";
    const localUrl = "http://localhost:3000/postdata"
    // console.log(payload);
    fetch(localUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => console.log("Analytics data sent successfully:", data))
      .catch((error) => {
        logError(error, { type: "AnalyticsSubmissionError" });
      });
  }

  function clearTimersAndIntervals() {
    if (metricsInterval) clearInterval(metricsInterval);
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    if (breakTimeout) clearTimeout(breakTimeout);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      clearTimersAndIntervals();
      saveEventsToServer({ reason: "Due to tab change" });
      stopRecording();
    }
  }

  function getErrorType(error, additionalInfo) {
    if (error instanceof TypeError) return "TypeError";
    if (error instanceof SyntaxError) return "SyntaxError";
    if (error instanceof ReferenceError) return "ReferenceError";
    if (error instanceof NetworkError) return "NetworkError";
    if (additionalInfo.type) return additionalInfo.type;
    if (error.name) return error.name;
    return "UnknownError";
  }

  function logError(error, additionalInfo = {}) {
    const errorEvent = {
      type: "error",
      time: Date.now(),
      url: getCurrentURL(),
      message: error.message || String(error),
      stack: error.stack,
      name: error.name,
      errorType: getErrorType(error, additionalInfo),
      additionalInfo: additionalInfo,
    };

    const isDuplicate = errorsArray.some(
      (e) =>
        e.message === errorEvent.message &&
        e.name === errorEvent.name &&
        JSON.stringify(e.additionalInfo) ===
          JSON.stringify(errorEvent.additionalInfo)
    );

    if (!isDuplicate) {
      errorsArray.push(errorEvent);
      sessionData.errorCount++; // Increment error count

      if (eventsArray.length > 0) {
        const lastEvent = eventsArray[eventsArray.length - 1];
        if (lastEvent) {
          lastEvent.error = errorEvent;
        }
      }
    }
  }

  window.onerror = function (message, source, lineno, colno, error) {
    logError(error || new Error(message), { source, lineno, colno });
  };

  window.addEventListener("error", (event) => {
    logError(event.error || new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logError(event.reason);
  });

  window.addEventListener("offline", () => {
    logError(new Error("Device went offline"), { type: "NetworkError" });
  });

  document.addEventListener("securitypolicyviolation", (event) => {
    logError(new Error("Content Security Policy violation"), {
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
      blockedURI: event.blockedURI,
    });
  });

  function captureFetchDetails(url, options, response, startTime) {
    const endTime = performance.now();
    fetchDetailsArray.push({
      time: Date.now(),
      url: url,
      method: options.method || "GET",
      status: response.status,
      statusText: response.statusText,
      duration: Math.round(endTime - startTime),
      type: "XHR/Fetch",
    });
  }

  const originalFetch = window.fetch;
  window.fetch = function (url, options = {}) {
    const startTime = performance.now();
    return originalFetch(url, options)
      .then((response) => {
        captureFetchDetails(url, options, response, startTime);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
      })
      .catch((error) => {
        logError(error, { url, options });
        throw error;
      });
  };

  function recordPageLoadMetrics() {
    if (window.performance && window.performance.getEntriesByType) {
      const nav = performance.getEntriesByType("navigation")[0];
      const lcp = performance
        .getEntriesByType("largest-contentful-paint")
        .pop();

      // Get the First Contentful Paint entry
      const fcp = performance
        .getEntriesByType("paint")
        .find((entry) => entry.name === "first-contentful-paint");

      const pageLoad = {
        type: "PageLoadMetrics",
        time: Date.now(),
        url: getCurrentURL(),
        initialPageLoadTime: Math.round(performance.now()),
        largestContentfulPaint: lcp ? Math.round(lcp.startTime) : null,
        firstContentfulPaint: fcp ? Math.round(fcp.startTime) : null, // Add FCP metric
        timeToFirstByte: Math.round(nav.responseStart - nav.startTime),
        domContentLoaded: Math.round(
          nav.domContentLoadedEventEnd - nav.startTime
        ),
        totalPageLoad: Math.round(nav.loadEventEnd - nav.startTime),
        resourceTimings: collectResourceTimings(),
      };

      pageLoadData.push(pageLoad);

      console.log(
        "Initial Page Load Time:",
        pageLoad.initialPageLoadTime,
        "ms"
      );
      console.log(
        "Largest Contentful Paint:",
        pageLoad.largestContentfulPaint,
        "ms"
      );
      console.log(
        "First Contentful Paint:",
        pageLoad.firstContentfulPaint,
        "ms"
      ); // Log FCP
      console.log("Time To First Byte:", pageLoad.timeToFirstByte, "ms");
      console.log("DOM Content Loaded:", pageLoad.domContentLoaded, "ms");
      console.log("Total Page Load:", pageLoad.totalPageLoad, "ms");
      console.log("Resource Timings:", pageLoad.resourceTimings);
    }
  }

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (...args) {
    this._url = args[1];
    this._method = args[0];
    return originalXHROpen.apply(this, args);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const startTime = performance.now();
    this.addEventListener("load", () => {
      captureFetchDetails(
        this._url,
        { method: this._method },
        {
          status: this.status,
          statusText: this.statusText,
        },
        startTime
      );
    });
    return originalXHRSend.apply(this, args);
  };

  function getPath(element) {
    const path = [];
    let currentElement = element;

    while (currentElement) {
      const parentNode = currentElement.parentNode;
      if (!parentNode) break;

      const children = parentNode.children;
      if (!children) break;

      const index = Array.prototype.indexOf.call(children, currentElement);
      const tag = currentElement.tagName.toLowerCase();

      const uniqueClass = Array.from(currentElement.classList).find((cls) =>
        cls.startsWith("randomElem_")
      );
      const classPart = uniqueClass ? `.${uniqueClass}` : "";

      path.unshift(`${tag}${classPart}:nth-child(${index + 1})`);
      currentElement = parentNode;
    }

    return path.join(" > ");
  }

  startRecording();
})();
