
(function () {
    let eventsArray = [];
    let errorsArray = [];
    let fetchDetailsArray = [];
    let observer;


    function getBehaviourCodeValues() {
      // Check if the BehaviourCode script is present in the document
      const scripts = document.querySelectorAll('script');
      let scriptFound = false;
  
      scripts.forEach((script) => {
          if (script.src === "https://cdn.lrkt-in.com/BehaviourCode.min.js") {
              scriptFound = true;
          }
      });
  
      if (scriptFound && window.BehaviourCode) {
          // Save the original init function
          const originalInit = window.BehaviourCode.init;
  
          // Override the init function to capture dynamic projectId and orgId
          window.BehaviourCode.init = function (projectIdOrgId) {
              // Split the input to get projectId and orgId
              const [projectId, orgId] = projectIdOrgId.toString().split('/');
  
              console.log("Project ID: ", projectId);
              console.log("Org ID: ", orgId);
  
              // Call the original init function to ensure behavior remains the same
              originalInit.apply(window.BehaviourCode, arguments);
  
              // Return the values as an object
              return { projectId, orgId };
          };
      } else {
          console.log("BehaviourCode script not found or not initialized.");
          return null;
      }
  }
  
 

 
    let sessionData = {
      userId: generateUniqueInteger(),
      startTime: new Date().toISOString(),
      ipAddress: null,
      browser: navigator.userAgent,
      device: null,
      endTime: null,
      location: null,
    };
  
    let classCounter = 0;
  
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
  
    async function getSessionIP() {
      try {
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json();
        sessionData.ipAddress = data.ip;
      } catch (error) {
        logError(error, { type: "IPFetchError" });
      }
    }
  
    navigator.geolocation.getCurrentPosition(
      (position) => {
        sessionData.location = `${position.coords.latitude},${position.coords.longitude}`;
      },
      (error) => {
        logError(error, { type: "GeolocationError" });
      }
    );
  
    function startRecording() {
      eventsArray = [];
      sessionData.startTime = new Date().toISOString();
  
      if (navigator.userAgentData) {
        sessionData.device = navigator.userAgentData.platform;
      } else {
        sessionData.device = navigator.platform;
      }
  
      getSessionIP().then(() => {
        assignUniqueClasses(document.documentElement);
        const initialHTML = document.documentElement.outerHTML;
        const baseHref = document.querySelector("base")?.href || document.baseURI;
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
          url: window.location.href,
          baseHref: baseHref,
          images: images,
          stylesheets: stylesheets,
          inlineStyles: inlineStyles,
          scripts: scripts,
          inlineScripts: inlineScripts,
        });
  
        recordPerformanceMetrics();
  
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
  
    function stopRecording() {
      if (observer) observer.disconnect();
      sessionData.endTime = new Date().toISOString();
      removeEventListeners();
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  
    function handlePopState(event) {
      try {
        const newHTML = document.documentElement.outerHTML;
        eventsArray.push({
          type: "navigation",
          html: newHTML,
          time: Date.now(),
          url: window.location.href,
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
  
    function addEventListeners() {
      window.addEventListener("scroll", recordScroll, true);
      window.addEventListener("popstate", recordNavigation, true);
      document.addEventListener("mousemove", recordMousemove, true);
      document.addEventListener("click", recordClick, true);
      document.addEventListener("keydown", recordKeydown, true);
      document.addEventListener("input", recordInput, true);
      document.addEventListener("submit", recordSubmit, true);
    }
  
    function removeEventListeners() {
      window.removeEventListener("scroll", recordScroll, true);
      window.removeEventListener("popstate", recordNavigation, true);
      document.removeEventListener("mousemove", recordMousemove, true);
      document.removeEventListener("click", recordClick, true);
      document.removeEventListener("keydown", recordKeydown, true);
      document.removeEventListener("input", recordInput, true);
      document.removeEventListener("submit", recordSubmit, true);
    }
  
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
  
      eventsArray.push(eventObj);
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
  
    function saveEventsToServer() {
      sessionData.endTime = new Date().toISOString();
        // Initialize and capture values dynamically
 
      const payload = {
        User_id: sessionData.userId,
        Start_time: sessionData.startTime,
        Ip_address: sessionData.ipAddress,
        Browser: sessionData.browser,
        Device: sessionData.device,
        End_time: sessionData.endTime,
        Location: sessionData.location,
        eventData: eventsArray,
        errorData: errorsArray,
        fetchData: fetchDetailsArray,

        // scustomData: sessionData.customData || {}
      };
      
      console.log('payload posted')
      fetch("http://localhost:3000/postdata", {
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
  
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        saveEventsToServer();
        stopRecording();
      }
    }
  
    function getErrorType(error, additionalInfo) {
      if (error instanceof TypeError) return "TypeError";
      if (error instanceof SyntaxError) return "SyntaxError";
      if (error instanceof ReferenceError) return "ReferenceError";
      if (additionalInfo.type) return additionalInfo.type;
      if (error.name) return error.name;
      return "UnknownError";
    }
  
    function logError(error, additionalInfo = {}) {
      const errorEvent = {
        type: "error",
        time: Date.now(),
        message: error.message || String(error),
        stack: error.stack,
        name: error.name,
        errorType: getErrorType(error, additionalInfo),
        additionalInfo: additionalInfo,
      };
  
      // Check for duplicates before adding
      const isDuplicate = errorsArray.some(
        (e) =>
          e.message === errorEvent.message &&
          e.name === errorEvent.name &&
          JSON.stringify(e.additionalInfo) ===
            JSON.stringify(errorEvent.additionalInfo)
      );
  
      if (!isDuplicate) {
        errorsArray.push(errorEvent);
  
        // Optionally attach to last event
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
  
    function captureFetchDetails(url, options, response) {
      fetchDetailsArray.push({
        time: Date.now(),
        url: url,
        method: options.method || "GET",
        status: response.status,
        statusText: response.statusText,
      });
    }
  
    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
      return originalFetch(url, options)
        .then((response) => {
          captureFetchDetails(url, options, response);
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
  
    function recordPerformanceMetrics() {
      if (window.performance && window.performance.getEntriesByType) {
        const nav = performance.getEntriesByType("navigation")[0];
        const lcp = performance
          .getEntriesByType("largest-contentful-paint")
          .pop();
  
        const performanceMetrics = {
          type: "performanceMetrics",
          time: Date.now(),
          initialPageLoadTime: Math.round(performance.now()),
          largestContentfulPaint: lcp ? Math.round(lcp.startTime) : null,
          timeToFirstByte: Math.round(nav.responseStart - nav.startTime),
          domContentLoaded: Math.round(
            nav.domContentLoadedEventEnd - nav.startTime
          ),
          totalPageLoad: Math.round(nav.loadEventEnd - nav.startTime),
        };
  
        // Add performanceMetrics as the first item in eventsArray
        eventsArray.push(performanceMetrics);
  
        // Log the specific metrics
        console.log(
          "Initial Page Load Time:",
          performanceMetrics.initialPageLoadTime,
          "ms"
        );
        console.log(
          "Largest Contentful Paint:",
          performanceMetrics.largestContentfulPaint,
          "ms"
        );
        console.log(
          "Time To First Byte:",
          performanceMetrics.timeToFirstByte,
          "ms"
        );
        console.log(
          "DOM Content Loaded:",
          performanceMetrics.domContentLoaded,
          "ms"
        );
        console.log("Total Page Load:", performanceMetrics.totalPageLoad, "ms");
      }
    }
  
    // function getPath(element) {
    //   const path = [];
    //   let currentElement = element;
    //   while (currentElement) {
    //     const parentNode = currentElement.parentNode;
    //     if (!parentNode) break;
    //     const children = parentNode.children;
    //     if (!children) break;
    //     const index = Array.prototype.indexOf.call(children, currentElement);
    //     const tag = currentElement.tagName.toLowerCase();
    //     path.unshift(`${tag}:nth-child(${index + 1})`);
    //     currentElement = parentNode;
    //   }
    //   return path.join(" > ");
    // }
  
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
  
    function generateUniqueInteger() {
      const min = 10000; // Minimum 5-digit number
      const max = 99999; // Maximum 5-digit number
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
  
    startRecording();
  
    // Save data when the page is unloaded
    window.addEventListener("beforeunload", saveEventsToServer);
  })();
  
