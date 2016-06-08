(function () {

  /**
   * Widget for controls
   * @constructor
   * @param {HTMLElement} container - A domElement where default control widget will be attached to
   */
  PANOLENS.Widget = function ( container ) {

    THREE.EventDispatcher.call( this );

    this.container = container;

    this.barElement;
    this.fullscreenElement;
    this.navigationElement;
    this.vrElement;
    this.videoElement;

  }

  PANOLENS.Widget.prototype = Object.create( THREE.EventDispatcher.prototype );

  PANOLENS.Widget.prototype.constructor = PANOLENS.Widget;

  /**
   * Add control bar
   */
  PANOLENS.Widget.prototype.addControlBar = function () {

    if ( !this.container ) {

      console.warn( 'Widget container not set' );
      return;
    }

    var scope = this, bar, styleTranslate, styleOpacity;

    bar = document.createElement( 'div' );
    bar.style.width = '100%';
    bar.style.height = '44px';
    bar.style.float = 'left';
    bar.style.transform = bar.style.webkitTransform = bar.style.msTransform = 'translateY(-100%)';
    bar.style.background = 'rgba( 0, 0, 0, 0.3 )';
    bar.style.transition = 'all 0.5s ease';
    bar.isHidden = false;
    bar.toggle = function () {
      bar.isHidden = !bar.isHidden;
      styleTranslate = bar.isHidden ? 'translateY(0)' : 'translateY(-100%)';
      styleOpacity = bar.isHidden ? 0 : 1;
      bar.style.transform = bar.style.webkitTransform = bar.style.msTransform = styleTranslate;
      bar.style.opacity = styleOpacity;
    };

    // Dispose
    bar.dispose = function () {

      if ( scope.fullscreenElement ) {

        bar.removeChild( scope.fullscreenElement );
        scope.fullscreenElement.dispose();
        scope.fullscreenElement = null;

      }

      if ( scope.navigationElement ) {

        bar.removeChild( scope.navigationElement );
        scope.navigationElement.dispose();
        scope.navigationElement = null;

      }

      if ( scope.vrElement ) {

        bar.removeChild( scope.vrElement );
        scope.vrElement.dispose();
        scope.vrElement = null;

      }

      if ( scope.videoElement ) {

        bar.removeChild( scope.videoElement );
        scope.videoElement.dispose();
        scope.videoElement = null;

      }

    };

    this.container.appendChild( bar );

    // Event listener
    this.addEventListener( 'control-bar-toggle', bar.toggle );

    this.barElement = bar;

  };

  /**
   * Add buttons on top of control bar
   * @param {string} name - The control button name to be created
   */
  PANOLENS.Widget.prototype.addControlButton = function ( name ) {

    this.fullscreenElement = name === 'fullscreen' ? this.createFullscreenButton() : this.fullscreenElement;
    this.navigationElement = name === 'navigation' ? this.createCameraControlButton() : this.navigationElement;
    this.vrElement = name === 'vr' ? this.createVRButton() : this.vrElement;
    this.videoElement = name === 'video' ? this.createVideoControl() : this.videoElement;

    // Add Control Items
    this.fullscreenElement && this.barElement.appendChild( this.fullscreenElement );
    this.navigationElement && this.barElement.appendChild( this.navigationElement );
    this.vrElement && this.barElement.appendChild( this.vrElement );
    this.videoElement && this.barElement.appendChild( this.videoElement );

  };

  /**
   * Create VR button
   * @return {HTMLSpanElement} - The dom element icon for VR effect
   * @fires PANOLENS.Widget#panolens-viewer-handler
   */
  PANOLENS.Widget.prototype.createVRButton = function () {

    var scope = this, item;

    function onTap () {

      /**
       * Viewer handler event
       * @type {object}
       * @property {string} method - 'toggleVR' function call on PANOLENS.Viewer
       */
      scope.dispatchEvent( { type: 'panolens-viewer-handler', method: 'toggleVR' } );

    }

    item = this.createCustomItem( {

      style : {

        backgroundImage : 'url("' + PANOLENS.DataImage.Cardboard + '")'

      },

      onTap : onTap

    } );

    return item;

  }

  /**
   * Create Fullscreen button
   * @return {HTMLSpanElement} - The dom element icon for fullscreen
   * @fires PANOLENS.Widget#panolens-viewer-handler
   */
  PANOLENS.Widget.prototype.createFullscreenButton = function () {

    var scope = this, item, isFullscreen = false;

    // Don't create button if no support
    if ( !document.fullscreenEnabled       &&
       !document.webkitFullscreenEnabled &&
       !document.mozFullScreenEnabled    &&
       !document.msFullscreenEnabled ) {
      return;
    }

    function onTap () {

      if ( !isFullscreen ) {
          scope.container.requestFullscreen && scope.container.requestFullscreen();
          scope.container.msRequestFullscreen && scope.container.msRequestFullscreen();
          scope.container.mozRequestFullScreen && scope.container.mozRequestFullScreen();
          scope.container.webkitRequestFullscreen && scope.container.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        isFullscreen = true;
        attachInfospotsToContainer();
      } else {
          document.exitFullscreen && document.exitFullscreen();
          document.msExitFullscreen && document.msExitFullscreen();
          document.mozCancelFullScreen && document.mozCancelFullScreen();
          document.webkitExitFullscreen && document.webkitExitFullscreen();
        isFullscreen = false;
      }

      this.style.backgroundImage = ( isFullscreen )
        ? 'url("' + PANOLENS.DataImage.FullscreenLeave + '")'
        : 'url("' + PANOLENS.DataImage.FullscreenEnter + '")';

      /**
       * Viewer handler event
       * @type {object}
       * @property {string} method - 'toggleFullscreen' function call on PANOLENS.Viewer
       */
      scope.dispatchEvent( { type: 'panolens-viewer-handler', method: 'toggleFullscreen', data: isFullscreen } );

    }

    // Attach infospot to container when fullscreen
    function attachInfospotsToContainer () {

      var infospotElements = document.querySelectorAll( '.panolens-infospot' );

      for ( var i = 0; i < infospotElements.length; i++ ) {

        if ( infospotElements[ i ].parentElement !== scope.container ) {

          scope.container.appendChild( infospotElements[ i ] );

        }

      }

    }

    item = this.createCustomItem( {

      style : {

        backgroundImage : 'url("' + PANOLENS.DataImage.FullscreenEnter + '")'

      },

      onTap : onTap

    } );

    return item;

  };

  /**
   * Create camera control button
   * @return {HTMLSpanElement} - The dom element icon for camera navigation
   * @fires PANOLENS.Widget#panolens-viewer-handler
   */
  PANOLENS.Widget.prototype.createCameraControlButton = function () {

    var scope = this, item;

    function onTap(){

      /**
       * Viewer handler event
       * @type {object}
       * @property {string} method - 'toggleNextControl' function call on PANOLENS.Viewer
       */
      scope.dispatchEvent( { type: 'panolens-viewer-handler', method: 'toggleNextControl' } );

      this.controlName = ( this.controlName === 'orbit' ) ? 'device-orientation' : 'orbit';

      this.style.backgroundImage = 'url("' + ( this.controlName === 'orbit'
        ? PANOLENS.DataImage.Gyro
        : PANOLENS.DataImage.Orbit ) + '")';

    }

    item = this.createCustomItem( {

      style: {

        backgroundImage: 'url("' + PANOLENS.DataImage.Gyro + '")'

      },

      onTap : onTap

    } );

    item.controlName = 'orbit';

    return item;

  };

  /**
   * Create video control container
   * @return {HTMLSpanElement} - The dom element icon for video control
   */
  PANOLENS.Widget.prototype.createVideoControl = function () {

    var item;

    item = document.createElement( 'span' );
    item.style.display = 'none';
    item.show = function () {

      item.style.display = '';

    };

    item.hide = function () {

      item.style.display = 'none';
      item.controlButton.paused = true;
      item.controlButton.update();
      item.seekBar.setProgress( 0 );
    };

    item.controlButton = this.createVideoControlButton();
    item.seekBar = this.createVideoControlSeekbar();

    item.appendChild( item.controlButton );
    item.appendChild( item.seekBar );

    item.dispose = function () {

      item.removeChild( item.controlButton );
      item.removeChild( item.seekBar );

      item.controlButton.dispose();
      item.controlButton = null;

      item.seekBar.dispose();
      item.seekBar = null;

    };

    this.addEventListener( 'video-control-show', item.show );
    this.addEventListener( 'video-control-hide', item.hide );

    return item;

  };

  /**
   * Create video control button
   * @return {HTMLSpanElement} - The dom element icon for video control
   * @fires PANOLENS.Widget#panolens-viewer-handler
   */
  PANOLENS.Widget.prototype.createVideoControlButton = function () {

    var scope = this, item;

    function onTap () {

      /**
       * Viewer handler event
       * @type {object}
       * @property {string} method - 'toggleVideoPlay' function call on PANOLENS.Viewer
       */
      scope.dispatchEvent( { type: 'panolens-viewer-handler', method: 'toggleVideoPlay', data: !this.paused } );

      this.paused = !this.paused;

      item.update();

    };

    item = this.createCustomItem( {

      style : {

        float : 'left',
        backgroundImage : 'url("' + PANOLENS.DataImage.VideoPlay + '")'

      },

      onTap : onTap

    } );

    item.paused = true;

    item.update = function () {

      this.style.backgroundImage = 'url("' + ( this.paused
        ? PANOLENS.DataImage.VideoPlay
        : PANOLENS.DataImage.VideoPause ) + '")';

    };

    return item;

  };

  /**
   * Create video seekbar
   * @return {HTMLSpanElement} - The dom element icon for video seekbar
   * @fires PANOLENS.Widget#panolens-viewer-handler
   */
  PANOLENS.Widget.prototype.createVideoControlSeekbar = function () {

    var scope = this, item, progressElement, progressElementControl,
      isDragging = false, mouseX, percentageNow, percentageNext;

    progressElement = document.createElement( 'div' );
    progressElement.style.width = '0%';
    progressElement.style.height = '100%';
    progressElement.style.backgroundColor = '#fff';

    progressElementControl = document.createElement( 'div' );
    progressElementControl.style.float = 'right';
    progressElementControl.style.width = '14px';
    progressElementControl.style.height = '14px';
    progressElementControl.style.transform = 'translate(7px, -5px)';
    progressElementControl.style.borderRadius = '50%';
    progressElementControl.style.backgroundColor = '#ddd';

    progressElementControl.addEventListener( 'mousedown', onMouseDown, false );
    progressElementControl.addEventListener( 'touchstart', onMouseDown, false );

    function onMouseDown ( event ) {

      event.stopPropagation();

      isDragging = true;

      mouseX = event.clientX || ( event.changedTouches && event.changedTouches[0].clientX );

      percentageNow = parseInt( progressElement.style.width ) / 100;

      addControlListeners();
    }

    function onVideoControlDrag ( event ) {

      var clientX;

      if( isDragging ){

        clientX = event.clientX || ( event.changedTouches && event.changedTouches[0].clientX );

        percentageNext = ( clientX - mouseX ) / item.clientWidth;

        percentageNext = percentageNow + percentageNext;

        percentageNext = percentageNext > 1 ? 1 : ( ( percentageNext < 0 ) ? 0 : percentageNext );

        item.setProgress ( percentageNext );

        /**
         * Viewer handler event
         * @type {object}
         * @property {string} method - 'setVideoCurrentTime' function call on PANOLENS.Viewer
         * @property {number} data - Percentage of current video. Range from 0.0 to 1.0
         */
        scope.dispatchEvent( { type: 'panolens-viewer-handler', method: 'setVideoCurrentTime', data: percentageNext } );

      }

    }

    function onVideoControlStop ( event ) {

      event.stopPropagation();

      isDragging = false;

      removeControlListeners();

    }

    function addControlListeners () {

      scope.container.addEventListener( 'mousemove', onVideoControlDrag, false );
      scope.container.addEventListener( 'mouseup', onVideoControlStop, false );
      scope.container.addEventListener( 'touchmove', onVideoControlDrag, false );
      scope.container.addEventListener( 'touchend', onVideoControlStop, false );


    }

    function removeControlListeners () {

      scope.container.removeEventListener( 'mousemove', onVideoControlDrag, false );
      scope.container.removeEventListener( 'mouseup', onVideoControlStop, false );
      scope.container.removeEventListener( 'touchmove', onVideoControlDrag, false );
      scope.container.removeEventListener( 'touchend', onVideoControlStop, false );

    }

    function onTap ( event ) {

      var percentage;

      if ( event.target === progressElementControl ) { return; }

      percentage = ( event.changedTouches && event.changedTouches.length > 0 )
        ? ( event.changedTouches[0].pageX - event.target.getBoundingClientRect().left ) / this.clientWidth
        : event.offsetX / this.clientWidth;

      /**
       * Viewer handler event
       * @type {object}
       * @property {string} method - 'setVideoCurrentTime' function call on PANOLENS.Viewer
       * @property {number} data - Percentage of current video. Range from 0.0 to 1.0
       */
      scope.dispatchEvent( { type: 'panolens-viewer-handler', method: 'setVideoCurrentTime', data: percentage } );

      item.setProgress( event.offsetX / this.clientWidth );

    };

    function onDispose () {

      removeControlListeners();
      progressElement = null;
      progressElementControl = null;

    }

    progressElement.appendChild( progressElementControl );

    item = this.createCustomItem( {

      style : {

        float : 'left',
        width : '30%',
        height : '4px',
        marginTop : '20px',
        backgroundColor : 'rgba(188,188,188,0.8)'

      },

      onTap : onTap,
      onDispose: onDispose

    } );

    item.appendChild( progressElement );

    item.setProgress = function( percentage ) {

      progressElement.style.width = percentage * 100 + '%';

    };

    this.addEventListener( 'video-update', function ( event ) {

      item.setProgress( event.percentage );

    } );

    return item;

  };

  /**
   * Create custom item element
   * @return {HTMLSpanElement} - The dom element icon
   */
  PANOLENS.Widget.prototype.createCustomItem = function ( options ) {

    options = options || {};

    var item = options.element || document.createElement( 'span' ),
      touchEnabled = ( document.ontouchend === undefined ) ? false : true;

    item.style.cursor = 'pointer';
    item.style.float = 'right';
    item.style.width = '44px';
    item.style.height = '100%';
    item.style.backgroundSize = '60%';
    item.style.backgroundRepeat = 'no-repeat';
    item.style.backgroundPosition = 'center';
    item.style.webkitUserSelect =
    item.style.MozUserSelect =
    item.style.userSelect = 'none';

    // White glow on icon
    item.addEventListener( touchEnabled ? 'touchstart' : 'mouseenter', function() {
      item.style.filter =
      item.style.webkitFilter = 'drop-shadow(0 0 5px rgba(255,255,255,1))';
    });
    item.addEventListener( touchEnabled ? 'touchend' : 'mouseleave', function() {
      item.style.filter =
      item.style.webkitFilter = '';
    });

    item = this.mergeStyleOptions( item, options.style );

    if ( options.onTap ) {

      item.addEventListener( touchEnabled ? 'touchend' : 'click', options.onTap, true );

    }

    item.dispose = function () {

      item.removeEventListener( touchEnabled ? 'touchend' : 'click', options.onTap, true );

      options.onDispose && options.onDispose();

    };

    return item;

  };

  /**
   * Merge item css style
   * @param  {HTMLDOMElement} element - The element to be merged with style
   * @param  {object} options - The style options
   * @return {HTMLDOMElement} - The same element with merged styles
   */
  PANOLENS.Widget.prototype.mergeStyleOptions = function ( element, options ) {

    options = options || {};

    for ( var property in options ){

      if ( options.hasOwnProperty( property ) ) {

        element.style[ property ] = options[ property ];

      }

    }

    return element;

  };

  /**
   * Dispose widgets by detaching dom elements from container
   */
  PANOLENS.Widget.prototype.dispose = function () {

    if ( this.barElement ) {
      this.container.removeChild( this.barElement );
      this.barElement.dispose();
      this.barElement = null;

    }

  };

})();