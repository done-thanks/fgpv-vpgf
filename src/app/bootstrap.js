(() => { // jshint ignore:line
    // disabled checks on above line due to 'too many statements in this function' (jshint W071)

    /**
     * Dynamically injects the main viewer script and styles references.
     * TODO: need to check how viewer works if there is already a version of jQuery on the page; maybe load a jQuery-less version of the viewer then.
     * Reference on script loading: http://www.html5rocks.com/en/tutorials/speed/script-loading/
     */

    // check if the global RV registry object already exists and store a reference
    const RV = window.RV = typeof window.RV === 'undefined' ? {} : window.RV;

    // test user browser, true if IE false otherwise
    RV.isIE = /Edge\/|Trident\/|MSIE /.test(window.navigator.userAgent);

    // Safari problem with file saver: https://github.com/eligrey/FileSaver.js/#supported-browsers
    // test if it is Safari browser on desktop and it if is, show a message to let user know we can't automatically save the file
    // they have to save it manually the same way as when the canvas is tainted.
    RV.isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent) &&
        !/(iPhone|iPod|iPad)/i.test(navigator.platform);

    // set these outside of the initial creation in case the page defines RV for setting
    // properties like dojoURL
    Object.assign(RV, {
        getMap,
        ready,
        allScriptsLoaded: false,
        debug: {},
        _nodes: null,
        _deferredPolyfills: RV._deferredPolyfills || [] // holds callback for any polyfills or patching that needs to be done after the core.js is loaded
    });

    // versions of scripts to inject
    const versions = {
        jQuery: '2.2.1',
        dataTables: '1.10.11'
    };
    const customAttrs = ['config', 'langs', 'service-endpoint', 'restore-bookmark', 'wait', 'keys', 'fullpage-app'];
    const URLs = {
        jQuery: `http://ajax.aspnetcdn.com/ajax/jQuery/jquery-${versions.jQuery}.min.js`,
        dataTables: `https://cdn.datatables.net/${versions.dataTables}/js/jquery.dataTables.min.js`
    };
    const d = document;
    const scripts = d.getElementsByTagName('script'); // get scripts

    // TODO: make more robust; this way of getting script's url might break if the `asyn` attribute is added on the script tag
    const seedUrl = scripts[scripts.length - 1].src; // get the last loaded script, which is this
    const repo = seedUrl.substring(0, seedUrl.lastIndexOf('/'));

    const headNode = d.getElementsByTagName('head')[0];
    const bodyNode = d.getElementsByTagName('body')[0];

    // inject styles
    const stylesLink = d.createElement('link');
    stylesLink.href = `${repo}/main.css`;
    stylesLink.type = 'text/css';
    stylesLink.rel = 'stylesheet';
    stylesLink.media = 'screen,print';

    headNode.appendChild(stylesLink);

    // inject fonts
    const fontsLink = d.createElement('link');
    fontsLink.href = 'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700,400italic';
    fontsLink.rel = 'stylesheet';

    headNode.appendChild(fontsLink);

    const scriptsArr = [];

    // append proper srcs to scriptsArray
    if (!window.jQuery) {
        // TODO: should we use a local file here instead?
        scriptsArr.push(URLs.jQuery, URLs.dataTables);
    } else if (!$.fn.dataTable) {
        scriptsArr.push(URLs.dataTables);
        versionCheck(versions.jQuery, $.fn.jquery, 'jQuery');
    } else {
        versionCheck(versions.jQuery, $.fn.jquery, 'jQuery');
        versionCheck(versions.dataTables, $.fn.dataTable.version, 'dataTable');
    }

    // registry of map proxies
    const mapRegistry = [];

    let readyQueue = []; // array of callbacks waiting on script loading to complete

    // appeasing this rule makes the code fail disallowSpaceAfterObjectKeys
    /* jscs:disable requireSpacesInAnonymousFunctionExpression */
    const mapProxy = {
        _appPromise: null,
        _initAppPromise: null,
        appID: null,

        _proxy(action, ...args) {
            return this._appPromise.then(appInstance =>
                appInstance[action](...args)
            );
        },

        _initProxy(action, ...args) {
            return this._initAppPromise.then(appInstance =>
                appInstance[action](...args)
            );
        },

        /**
         * RCS layers to be loaded once the map has been instantiated.
         *
         * @function    loadRcsLayers
         * @param {Array}  keys  array of strings containing RCS keys to be added
         */
        loadRcsLayers(keys) {
            this._proxy('loadRcsLayers', keys);
        },

        /**
         * Sets the translation language and reloads the map.
         *
         * @function    setLanguage
         * @param   {String}    lang    the new language to use
         */
        setLanguage(lang) {
            this._proxy('setLanguage', lang);
        },

        /**
         * Returns a bookmark for the current viewers state.
         *
         * @function    getBookmark
         * @returns     {Promise}    a promise that resolves to the bookmark containing the state of the viewer
         */
        getBookmark() {
            return this._proxy('getBookmark');
        },

        /**
         * Updates the map using bookmark.
         *
         * @function    useBookmark
         * @param   {String}    bookmark    bookmark containing the desired state of the viewer
         */
        useBookmark(bookmark) {
            this._proxy('useBookmark', bookmark);
        },

        /**
         * Initializes the viewer with this bookmark.
         *
         * Whereas useBookmark can be called multiple times at any point in the viewers lifecycle, initialBookmark is meant to provide the viewer with a starting bookmark. Therefore it should only be invoked once as the very first bookmark.
         *
         * Note that the $rootElement must have the rv-wait attribute set for this function to have any effect. This informs the viewer to wait until you provide an initial bookmark.
         *
         * @function    initialBookmark
         * @param   {String}    bookmark    bookmark containing the desired state of the viewer
         */
        initialBookmark(bookmark) {
            this._initProxy('initialBookmark', bookmark);
        },

        /**
         *  Updates the extent of the map by centering and zooming the map.
         *
         * @function    centerAndZoom
         * @param {Number} x                    The x coord to center on
         * @param {Number} y                    The y coord to center on
         * @param {Object} spatialRef           The spatial reference for the coordinates
         * @param {Number} zoom                 The level to zoom to
         */
        centerAndZoom(x, y, spatialRef, zoom) {
            this._proxy('centerAndZoom', x, y, spatialRef, zoom);
        },

        /**
         * Loads using a bookmark from sessionStorage (if found) and a keyList.
         *
         * @function    restoreSession
         * @param   {Array}     keys      array of strings containing RCS keys to load
         */
        restoreSession(keys) {
            this._initProxy('restoreSession', keys);
        },

        /**
         * Returns an array of ids for rcs added layers.
         *
         * @function    getRcsLayerIDs
         * @returns     {Promise}     a promise which resolves to a list of rcs layer ids
         */
        getRcsLayerIDs() {
            return this._proxy('getRcsLayerIDs');
        },

        /**
         * Registers a plugin with a viewer instance.
         * This function expects a minimum of two parameters such that:
         *   - the first parameter is a plugin class reference
         *   - the second parameter is a unique plugin id string
         * Any additional parameters will be passed to the plugins init method
         *
         * @function    registerPlugin
         */
        registerPlugin() {
            this._loadPromise.then(app => app.registerPlugin(...arguments));
        },

        _init(appID) {
            this.appID = appID;

            this._appPromise = new Promise(resolve =>
                // store a callback function in the proxy object itself for map instances to call upon readiness
                this._registerMap = appInstance =>
                    // resolve with the actual instance of the map;
                    // after this point, all queued calls to `loadRcsLayers`, `setLanguage`, etc. will trigger
                    resolve(appInstance)
            );

            // this promise waits to be resolved by the rvReady event on the angular side
            // unlike the other promises this is only resolved once during the page load cycle
            if (typeof this._loadPromise === 'undefined') {
                this._loadPromise = new Promise(resolve =>
                    // store a callback function in the proxy object itself for map instances to call upon readiness
                    this._applicationLoaded = appInstance => resolve(appInstance)
                );
            }

            this._initAppPromise = new Promise(resolve =>
                // store a callback function in the proxy object itself for map instances to call upon readiness
                this._registerPreLoadApi = appInstance =>
                    // resolve with the actual instance of the map;
                    // after this point, all queued calls to `loadRcsLayers`, `setLanguage`, etc. will trigger
                    resolve(appInstance)
            );

            return this;
        },

        _deregisterMap() {
            this._init();
        }
    };
    /* jshint:enable requireSpacesInAnonymousFunctionExpression */

    // convert html collection to array:
    // https://babeljs.io/docs/learn-es2015/#math-number-string-object-apis
    const nodes = [].slice.call(document.getElementsByClassName('fgpv'));
    const isAttrNodes = [].slice.call(document.querySelectorAll('[is=rv-map]'));
    isAttrNodes.filter(node => nodes.indexOf(node) === -1).forEach(node => nodes.push(node));

    // store nodes to use in app-seed; avoids a second DOM traversal
    RV._nodes = nodes;

    let counter = 0;

    nodes.forEach(node => {

        let appId = node.getAttribute('id');
        customAttrs
            .filter(attrName => node.getAttribute(`data-rv-${attrName}`))
            .forEach(attrName => node.setAttribute(`rv-${attrName}`, node.getAttribute(`data-rv-${attrName}`))); // getAttribute returns a string so data-rv-fullscreen-app="false" will copy correctly

        if (!appId) {
            appId = 'rv-app-' + counter++;
            node.setAttribute('id', appId);
        }

        node.setAttribute('rv-trap-focus', appId);

        // basic touch device detection; if detected set rv-touch class so that touch mode is on by default
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            node.className += ' rv-touch';
        }

        console.info('setting debug on', appId, node);
        // create debug object for each app instance
        RV.debug[appId] = {};

        mapRegistry[appId] = Object.create(mapProxy)._init(appId);
    });

    scriptsArr.forEach(src => loadScript(src));

    // load core.js last and execute any deferred polyfills/patches
    loadScript(`${repo}/core.js`, () => {
        RV._deferredPolyfills.forEach(dp => dp());
        RV.focusManager.init();
        RV.allScriptsLoaded = true;
        fireRvReady();
    });

    /***/

    /**
     * Called to buffer code until the library code has been fully loaded.  Behaves similar to jQuery style DOM ready events.
     * @function
     * @param {Function} callBack a function to be called once the library is loaded
     */
    function ready(callBack) {
        if (RV.allScriptsLoaded) {
            callBack();
        } else {
            readyQueue.push(callBack);
        }
    }

    /**
     * Fires all callbacks waiting on the ready event and empties the callback queue.
     * @private
     */
    function fireRvReady() {
        readyQueue.forEach(cb => cb());
        readyQueue = [];
    }

    // external "sync" function to retrieve a map instance
    // in reality it returns a map proxy queueing calls to the map until it's ready
    function getMap(id) {
        return mapRegistry[id];
    }

    /**
     * Load a script and execute an optional callback
     * @function
     * @private
     * @param {String} src url of the script to load
     * @param {Function} loadCallback [optional] a callback to execute on script load
     * @return {Object} script tag
     */
    function loadScript(src, loadCallback) {
        const currScript = d.createElement('script');
        currScript.src = src;
        currScript.async = false;
        currScript.type = 'text/javascript';

        if (typeof loadCallback === 'function') {
            currScript.addEventListener('load', loadCallback);
        }

        bodyNode.appendChild(currScript);

        return currScript;
    }

    /**
     * Compares two versions of a script, prints warnings to the console if the versions are not the same
     *
     * @private
     * @function versionCheck
     * @param  {String} ourVersion      our version of the script
     * @param  {String} theirVersion    their version of the script
     * @param  {String} scriptName      the name of the script
     */
    function versionCheck(ourVersion, theirVersion, scriptName) {
        ourVersion = ourVersion.split('.');
        const versionDiff = theirVersion.split('.')
            // compare the two versions
            .map((x, index) => parseInt(x) - ourVersion[index])
            // find first non-equal part
            .find(x => x !== 0);

        if (typeof versionDiff === 'undefined') {
            // the versions were equal
            return;
        }
        const fillText = versionDiff > 0 ? 'more recent' : 'older';
        console.warn(`The current ${scriptName} version is ${fillText} than expected for the viewer; ` +
                        `expected: ${versions.jQuery}`);
    }
})();

(function() {
    'use strict';

    const RV = window.RV; // just a reference
    RV.debug._trackFocus = trackFocusBuilder();

    /**
     * Builds a focus tracking debug option.
     * @function trackFocusBuilder
     * @private
     * @return function  enables/disabled focus/blur event tracking on the page; this function accepts a boolean - `true` enables tracking; `false`, disables it
     */
    function trackFocusBuilder() {
        let lastActiveElement = document.activeElement;

        let isActive = false;

        return () => {
            isActive = !isActive;
            if (isActive) {
                console.debug('trackFocus is enabled.');
                attachEvents();
            } else {
                console.debug('trackFocus is disabled.');
                detachEvents();
            }
        };

        /***/

        /**
         * Logs blur events.
         * @function detectBlur
         * @private
         * @param  {Object} event blur event
         */
        function detectBlur(event) {
            // Do logic related to blur using document.activeElement;
            // You can do change detection too using lastActiveElement as a history
            console.debug('[trackFocus]: blur', document.activeElement, event, isSameActiveElement());
        }

        /**
         * Checks if the currently active element is the same as the previosly focused one.
         * @function isSameActiveElement
         * @private
         * @return {Boolean} true if it's the same object
         */
        function isSameActiveElement() {
            let currentActiveElement = document.activeElement;
            if (lastActiveElement !== currentActiveElement) {
                lastActiveElement = currentActiveElement;
                return false;
            }

            return true;
        }

        /**
         * Logs focus events.
         * @function detectFocus
         * @private
         * @param  {Object} event focus event
         */
        function detectFocus(event) {
            // Add logic to detect focus and to see if it has changed or not from the lastActiveElement.
            console.debug('[trackFocus]: focus', document.activeElement, event, isSameActiveElement());
        }

        /**
         * Attaches listeners to the window to listen for focus and blue events.
         * @function attachEvents
         * @private
         */
        function attachEvents() {
            window.addEventListener('focus', detectFocus, true);
            window.addEventListener('blur', detectBlur, true);
        }

        /**
         * Detaches focus and blur listeners from the window.
         * @function detachEvents
         * @private
         */
        function detachEvents() {
            window.removeEventListener('focus', detectFocus, true);
            window.removeEventListener('blur', detectBlur, true);
        }
    }
}());
