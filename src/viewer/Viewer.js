( function () {

  'use strict';

  /**
   * Viewer contains pre-defined scene, camera and renderer
   * @constructor
   * @param {object} [options] - Use custom or default config options
   * @param {HTMLElement} [options.container] - A HTMLElement to host the canvas
   * @param {THREE.Scene} [options.scene=THREE.Scene] - A THREE.Scene which contains panorama and 3D objects
   * @param {THREE.Camera} [options.camera=THREE.PerspectiveCamera] - A THREE.Camera to view the scene
   * @param {THREE.WebGLRenderer} [options.renderer=THREE.WebGLRenderer] - A THREE.WebGLRenderer to render canvas
   * @param {boolean} [options.controlBar=true] - Show/hide control bar on the bottom of the container
   * @param {array}   [options.controlButtons=[]] - Button names to mount on controlBar if controlBar exists, Defaults to ['fullscreen', 'navigation', 'vr', 'video']
   * @param {boolean} [options.autoHideControlBar=false] - Auto hide control bar when click on non-active area
   * @param {boolean} [options.autoHideInfospot=true] - Auto hide infospots when click on non-active area
   * @param {boolean} [options.horizontalView=false] - Allow only horizontal camera control
   * @param {number}  [options.clickTolerance=10] - Distance tolerance to tigger click / tap event
   * @param {number}  [options.cameraFov=60] - Camera field of view value
   * @param {boolean} [options.reverseDragging=false] - Reverse dragging direction
   * @param {boolean} [options.enableReticle=false] - Enable reticle for mouseless interaction other than VR mode
   * @param {number}  [options.dwellTime=1500] - Dwell time for reticle selection
   * @param {boolean} [options.autoReticleSelect=true] - Auto select a clickable target after dwellTime
   * @param {boolean} [options.passiveRendering=false] - Render only when control triggered by user input
   */
  PANOLENS.Viewer = function ( options ) {

    THREE.EventDispatcher.call( this );

    if ( !THREE ) {

      console.error('Three.JS not found');

      return;
    }

    var container;

    options = options || {};
    options.controlBar = options.controlBar !== undefined ? options.controlBar : true;
    options.controlButtons = options.controlButtons || [ 'fullscreen', 'navigation', 'vr', 'video' ];
    options.autoHideControlBar = options.autoHideControlBar !== undefined ? options.autoHideControlBar : false;
    options.autoHideInfospot = options.autoHideInfospot !== undefined ? options.autoHideInfospot : true;
    options.horizontalView = options.horizontalView !== undefined ? options.horizontalView : false;
    options.clickTolerance = options.clickTolerance || 10;
    options.cameraFov = options.cameraFov || 60;
    options.reverseDragging = options.reverseDragging || false;
    options.enableReticle = options.enableReticle || false;
    options.dwellTime = options.dwellTime || 1500;
    options.autoReticleSelect = options.autoReticleSelect !== undefined ? options.autoReticleSelect : true;
    options.passiveRendering = options.passiveRendering || false;

    this.options = options;

    // Container
    if ( options.container ) {

      container = options.container;

    } else {

      container = document.createElement( 'div' );
      container.style.width = window.innerWidth + 'px';
      container.style.height = window.innerHeight + 'px';
      document.body.appendChild( container );

      // For matching body's width and height dynamically on the next tick to
      // avoid 0 height in the beginning
      setTimeout( function () {
        container.style.width = '100%';
        container.style.height = '100%';
      }, 0 );

    }

    this.container = container;

    this.camera = options.camera || new THREE.PerspectiveCamera( this.options.cameraFov, this.container.clientWidth / this.container.clientHeight, 1, 10000 );
    this.scene = options.scene || new THREE.Scene();
    this.renderer = options.renderer || new THREE.WebGLRenderer( { alpha: true, antialias: true } );
    this.effect;

    this.reticle = {};
    this.tempEnableReticle = this.options.enableReticle;

    this.mode = PANOLENS.Modes.NORMAL;

    this.OrbitControls;
    this.DeviceOrientationControls;

    this.controls;
    this.panorama;
    this.widget;

    this.hoverObject;
    this.infospot;
    this.pressEntityObject;
    this.pressObject;

    this.raycaster = new THREE.Raycaster();
    this.raycasterPoint = new THREE.Vector2();
    this.userMouse = new THREE.Vector2();
    this.updateCallbacks = [];
    this.requestAnimationId;

    // Handler references
    this.HANDLER_MOUSE_DOWN = this.onMouseDown.bind( this );
    this.HANDLER_MOUSE_UP = this.onMouseUp.bind( this );
    this.HANDLER_MOUSE_MOVE = this.onMouseMove.bind( this );
    this.HANDLER_WINDOW_RESIZE = this.onWindowResize.bind( this );
    this.HANDLER_KEY_DOWN = this.onKeyDown.bind( this );
    this.HANDLER_KEY_UP = this.onKeyUp.bind( this );
    this.HANDLER_TAP = this.onTap.bind( this, {
      clientX: this.container.clientWidth / 2,
      clientY: this.container.clientHeight / 2
    } );

    // Flag for infospot output
    this.OUTPUT_INFOSPOT = false;

    // Renderer
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( this.container.clientWidth, this.container.clientHeight );
    this.renderer.setClearColor( 0x000000, 1 );

    // Append Renderer Element to container
    this.renderer.domElement.classList.add( 'panolens-canvas' );
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild( this.renderer.domElement );

    // Camera Controls
    this.OrbitControls = new THREE.OrbitControls( this.camera, this.container, this.options.passiveRendering );
    this.OrbitControls.name = 'orbit';
    this.OrbitControls.minDistance = 1;
    this.OrbitControls.noPan = true;
    this.DeviceOrientationControls = new THREE.DeviceOrientationControls( this.camera );
    this.DeviceOrientationControls.name = 'device-orientation';
    this.DeviceOrientationControls.enabled = false;

    // Register change event if passiveRenering
    if ( this.options.passiveRendering ) {

      this.OrbitControls.addEventListener( 'change', this.onChange.bind( this ) );
      this.DeviceOrientationControls.addEventListener( 'change', this.onChange.bind( this ) );

    }

    // Cardboard effect
        this.effect = new THREE.CardboardEffect( this.renderer );
        this.effect.setSize( this.container.clientWidth, this.container.clientHeight );

    this.controls = [ this.OrbitControls, this.DeviceOrientationControls ];
    this.control = this.OrbitControls;

    // Add default hidden reticle
    this.addReticle();

    // Lock horizontal view
    if ( this.options.horizontalView ) {
      this.OrbitControls.minPolarAngle = Math.PI / 2;
      this.OrbitControls.maxPolarAngle = Math.PI / 2;
    }

    // Add Control UI
    if ( this.options.controlBar !== false ) {
      this.addDefaultControlBar( this.options.controlButtons );
    }

    // Reverse dragging direction
    if ( this.options.reverseDragging ) {
      this.reverseDraggingDirection();
    }

    // Register event if reticle is enabled, otherwise defaults to mouse
    if ( this.options.enableReticle ) {
      this.reticle.show();
      this.registerReticleEvent();
    } else {
      this.registerMouseAndTouchEvents();
    }

    // Register dom event listeners
    this.registerEventListeners();

    // Animate
    this.animate.call( this );

  }

  PANOLENS.Viewer.prototype = Object.create( THREE.EventDispatcher.prototype );

  PANOLENS.Viewer.prototype.constructor = PANOLENS.Viewer;

  /**
   * Add an object to the scene
   * Automatically hookup with panolens-viewer-handler listener
   * to communicate with viewer method
   * @param {THREE.Object3D} object - The object to be added
   */
  PANOLENS.Viewer.prototype.add = function ( object ) {

    if ( arguments.length > 1 ) {

      for ( var i = 0; i < arguments.length; i ++ ) {

        this.add( arguments[ i ] );

      }

      return this;

    }

    this.scene.add( object );

    // All object added to scene has 'panolens-viewer-handler' event to handle viewer communication
    if ( object.addEventListener ) {

      object.addEventListener( 'panolens-viewer-handler', this.eventHandler.bind( this ) );

    }

    // All object added to scene being passed with container
    if ( object instanceof PANOLENS.Panorama && object.dispatchEvent ) {

      object.dispatchEvent( { type: 'panolens-container', container: this.container } );

    }

    // Hookup default panorama event listeners
    if ( object.type === 'panorama' ) {

      this.addPanoramaEventListener( object );

      if ( !this.panorama ) {

        this.setPanorama( object );

      }

    }

  };

  /**
   * Remove an object from the scene
   * @param  {THREE.Object3D} object - Object to be removed
   */
  PANOLENS.Viewer.prototype.remove = function ( object ) {

    if ( object.removeEventListener ) {

      object.removeEventListener( 'panolens-viewer-handler', this.eventHandler.bind( this ) );

    }

    this.scene.remove( object );

  };

  /**
   * Add default control bar
   * @param {array} array - The control buttons array
   */
  PANOLENS.Viewer.prototype.addDefaultControlBar = function ( array ) {

    var scope = this;

    if ( this.widget ) {

      console.warn( 'Default control bar exists' );
      return;

    }

    this.widget = new PANOLENS.Widget( this.container );
    this.widget.addEventListener( 'panolens-viewer-handler', this.eventHandler.bind( this ) );
    this.widget.addControlBar();
    array.forEach( function( buttonName ){

      scope.widget.addControlButton( buttonName );

    } );

  };

  /**
   * Set a panorama to be the current one
   * @param {PANOLENS.Panorama} pano - Panorama to be set
   */
  PANOLENS.Viewer.prototype.setPanorama = function ( pano ) {

    if ( pano.type === 'panorama' ) {

      // Clear exisiting infospot
      this.hideInfospot();

      // Reset Current Panorama
      this.panorama && this.panorama.onLeave();

      // Assign and enter panorama
      (this.panorama = pano).onEnter();

    }

  };

  /**
   * Event handler to execute commands from child objects
   * @param {object} event - The dispatched event with method as function name and data as an argument
   */
  PANOLENS.Viewer.prototype.eventHandler = function ( event ) {

    if ( event.method && this[ event.method ] ) {

      this[ event.method ]( event.data );

      this.options.passiveRendering && this.onChange();

    }

  };

  /**
   * Toggle VR effect mode and broadcast event to infospot descendants
   * @fires PANOLENS.Viewer#VR-toggle
   * @fires PANOLENS.Infospot#VR-toggle
   */
  PANOLENS.Viewer.prototype.toggleVR = function () {

    var event;

    if ( this.effect ) {

      if ( this.mode !== PANOLENS.Modes.VR ) {

        this.mode = PANOLENS.Modes.VR;

      } else {

        this.mode = PANOLENS.Modes.NORMAL;

      }
    }

    event = { type: 'VR-toggle', mode: this.mode };

    /**
     * Toggle vr event
     * @type {object}
     * @event PANOLENS.Viewer#VR-toggle
     * @event PANOLENS.Infospot#VR-toggle
     * @property {PANOLENS.Modes} mode - Current display mode
     */
    this.dispatchEvent( event );
    this.scene.traverse( function ( object ) {

      if ( object.dispatchEvent ) {

        object.dispatchEvent( event );

      }

    });

    if ( this.mode === PANOLENS.Modes.VR ) {

      this.enableVR();

    } else {

      this.disableVR();

    }

  };

  /**
   * Enable VR effect
   */
  PANOLENS.Viewer.prototype.enableVR = function () {

    if ( this.effect && this.mode === PANOLENS.Modes.VR ) {

      this.tempEnableReticle = true;

      // Register reticle event and unregister mouse event
      this.unregisterMouseAndTouchEvents();

      this.reticle.show();
      this.registerReticleEvent();

      this.updateReticleEvent( this.mode );


    }

  };

  /**
   * Disable VR effect
   */
  PANOLENS.Viewer.prototype.disableVR = function () {

    if ( this.effect && this.mode === PANOLENS.Modes.NORMAL ) {

      this.tempEnableReticle = false;

      // Register mouse event and unregister reticle event
      if ( !this.options.enableReticle ) {

        this.reticle.hide();
        this.unregisterReticleEvent();
        this.registerMouseAndTouchEvents();

      } else {

        this.updateReticleEvent( this.mode );

      }

    }

  };

  /**
   * Toggle video play or stop
   * @fires PANOLENS.Viewer#video-toggle
   */
  PANOLENS.Viewer.prototype.toggleVideoPlay = function ( pause ) {

    if ( this.panorama instanceof PANOLENS.VideoPanorama ) {

      /**
       * Toggle video event
       * @type {object}
       * @event PANOLENS.Viewer#video-toggle
       */
      this.panorama.dispatchEvent( { type: 'video-toggle', pause: pause } );

      if ( this.options.passiveRendering ) {

        if ( !pause ) {

          var loop = function (){
            this.requestAnimationId = window.requestAnimationFrame( loop.bind( this ) );
            this.onChange();
          }.bind(this);

          loop();

        } else {

          window.cancelAnimationFrame( this.requestAnimationId );

        }

      }

    }

  };

  /**
   * Set currentTime in a video
   * @param {number} percentage - Percentage of a video. Range from 0.0 to 1.0
   * @fires PANOLENS.Viewer#video-time
   */
  PANOLENS.Viewer.prototype.setVideoCurrentTime = function ( percentage ) {

    if ( this.panorama instanceof PANOLENS.VideoPanorama ) {

      /**
       * Setting video time event
       * @type {object}
       * @event PANOLENS.Viewer#video-time
       * @property {number} percentage - Percentage of a video. Range from 0.0 to 1.0
       */
      this.panorama.dispatchEvent( { type: 'video-time', percentage: percentage } );

    }

  };

  /**
   * This will be called when video updates if an widget is present
   * @param {number} percentage - Percentage of a video. Range from 0.0 to 1.0
   * @fires PANOLENS.Viewer#video-update
   */
  PANOLENS.Viewer.prototype.onVideoUpdate = function ( percentage ) {

    /**
     * Video update event
     * @type {object}
     * @event PANOLENS.Viewer#video-update
     * @property {number} percentage - Percentage of a video. Range from 0.0 to 1.0
     */
    this.widget && this.widget.dispatchEvent( { type: 'video-update', percentage: percentage } );

  };

  /**
   * Add update callback to be called every animation frame
   */
  PANOLENS.Viewer.prototype.addUpdateCallback = function ( fn ) {

    if ( fn ) {

      this.updateCallbacks.push( fn );

    }

  };

  /**
   * Remove update callback
   * @param  {Function} fn - The function to be removed
   */
  PANOLENS.Viewer.prototype.removeUpdateCallback = function ( fn ) {

    var index = this.updateCallbacks.indexOf( fn );

    if ( fn && index >= 0 ) {

      this.updateCallbacks.splice( index, 1 );

    }

  };

  /**
   * Show video widget
   */
  PANOLENS.Viewer.prototype.showVideoWidget = function () {

    /**
     * Show video widget event
     * @type {object}
     * @event PANOLENS.Viewer#video-control-show
     */
    this.widget && this.widget.dispatchEvent( { type: 'video-control-show' } );

  };

  /**
   * Hide video widget
   */
  PANOLENS.Viewer.prototype.hideVideoWidget = function () {

    /**
     * Hide video widget
     * @type {object}
     * @event PANOLENS.Viewer#video-control-hide
     */
    this.widget && this.widget.dispatchEvent( { type: 'video-control-hide' } );

  };

  /**
   * Add default panorama event listeners
   * @param {PANOLENS.Panorama} pano - The panorama to be added with event listener
   */
  PANOLENS.Viewer.prototype.addPanoramaEventListener = function ( pano ) {

    var scope = this;

    // Set camera control on every panorama
    pano.addEventListener( 'enter-animation-start', this.setCameraControl.bind( this ) );

    // Start panorama leaves
    pano.addEventListener( 'leave', function () {
      if ( scope.options.passiveRendering ) {
        window.cancelAnimationFrame( scope.requestAnimationId );
        scope.animate();
      }
    } );

    // Render view once enter completes
    pano.addEventListener( 'enter-complete', function(){
      if ( scope.options.passiveRendering ) {
        scope.control.update( true );
        scope.render();
      }
    } );

    // Stop animation when infospot finally shows up
    pano.addEventListener( 'infospot-animation-complete', function( event ) {
      if ( scope.options.passiveRendering && event.visible ) {
        window.cancelAnimationFrame( scope.requestAnimationId );
        scope.render();
      }
    } );

    // Show and hide widget event only when it's PANOLENS.VideoPanorama
    if ( pano instanceof PANOLENS.VideoPanorama ) {

      pano.addEventListener( 'enter', this.showVideoWidget.bind( this ) );
      pano.addEventListener( 'leave', this.hideVideoWidget.bind( this ) );

    }

  };

  /**
   * Set camera control
   */
  PANOLENS.Viewer.prototype.setCameraControl = function () {

    this.camera.position.copy( this.panorama.position );
    this.camera.position.z += 1;
    this.OrbitControls.target.copy( this.panorama.position );

  };

  /**
   * Get current camera control
   * @return {object} - Current navigation control. THREE.OrbitControls or THREE.DeviceOrientationControls
   */
  PANOLENS.Viewer.prototype.getControl = function () {

    return this.control;

  },

  /**
   * Get scene
   * @return {THREE.Scene} - Current scene which the viewer is built on
   */
  PANOLENS.Viewer.prototype.getScene = function () {

    return this.scene;

  };

  /**
   * Get camera
   * @return {THREE.Camera} - The scene camera
   */
  PANOLENS.Viewer.prototype.getCamera = function () {

    return this.camera;

  },

  /**
   * Get renderer
   * @return {THREE.WebGLRenderer} - The renderer using webgl
   */
  PANOLENS.Viewer.prototype.getRenderer = function () {

    return this.renderer;

  };

  /**
   * Get container
   * @return {HTMLDOMElement} - The container holds rendererd canvas
   */
  PANOLENS.Viewer.prototype.getContainer = function () {

    return this.container;

  };

  /**
   * Get control name
   * @return {string} - Control name. 'orbit' or 'device-orientation'
   */
  PANOLENS.Viewer.prototype.getControlName = function () {

    return this.control.name;

  };

  /**
   * Get next navigation control name
   * @return {string} - Next control name
   */
  PANOLENS.Viewer.prototype.getNextControlName = function () {

    return this.controls[ this.getNextControlIndex() ].name;

  };

  /**
   * Get next navigation control index
   * @return {number} - Next control index
   */
  PANOLENS.Viewer.prototype.getNextControlIndex = function () {

    var controls, control, nextIndex;

    controls = this.controls;
    control = this.control;
    nextIndex = controls.indexOf( control ) + 1;

    return ( nextIndex >= controls.length ) ? 0 : nextIndex;

  };

  /**
   * Set field of view of camera
   */
  PANOLENS.Viewer.prototype.setCameraFov = function ( fov ) {

    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

  };

  /**
   * Enable control by index
   * @param  {number} index - Index of camera control
   */
  PANOLENS.Viewer.prototype.enableControl = function ( index ) {

    index = ( index >= 0 && index < this.controls.length ) ? index : 0;

    this.control.enabled = false;

    this.control = this.controls[ index ];

    this.control.enabled = true;

    switch ( this.control.name ) {
      case 'orbit':
        this.camera.position.copy( this.panorama.position );
        this.camera.position.z += 1;
        break;
      case 'device-orientation':
        this.camera.position.copy( this.panorama.position );
        break;
      default:
        break;
    }

    this.control.update();

  };

  /**
   * Toggle next control
   */
  PANOLENS.Viewer.prototype.toggleNextControl = function () {

    this.enableControl( this.getNextControlIndex() );

  };

  /**
   * Toggle fullscreen
   * @param  {Boolean} isFullscreen - If it's fullscreen
   */
  PANOLENS.Viewer.prototype.toggleFullscreen = function ( isFullscreen ) {

    if ( isFullscreen ) {
      this.container._width = this.container.clientWidth;
      this.container._height = this.container.clientHeight;
      this.container.style.width = '100%';
      this.container.style.height = '100%';
    } else {
      this.container._width && ( this.container.style.width = this.container._width + 'px' );
      this.container._height && ( this.container.style.height = this.container._height + 'px' );
    }

  };

  /**
   * Reverse dragging direction
   */
  PANOLENS.Viewer.prototype.reverseDraggingDirection = function () {

    this.OrbitControls.rotateSpeed *= -1;
    this.OrbitControls.momentumScalingFactor *= -1;

  };

  /**
   * Add reticle
   */
  PANOLENS.Viewer.prototype.addReticle = function () {

    this.reticle = new PANOLENS.Reticle( 0x1abc9c );
    this.reticle.position.z = -10;
    this.reticle.scale.multiplyScalar( 0.3 );
    this.camera.add( this.reticle );
    this.scene.add( this.camera );

  };

  /**
   * This is called when window size is changed
   * @fires PANOLENS.Viewer#window-resize
   */
  PANOLENS.Viewer.prototype.onWindowResize = function () {

    var width, height;

    width = this.container.clientWidth;
    height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize( width, height );

    // Update reticle
    if ( this.options.enableReticle || this.tempEnableReticle ) {

      this.updateReticleEvent( this.mode );

    }

    // Passive render after window size changes
    this.options.passiveRendering && this.render();

    /**
     * Window resizing event
     * @type {object}
     * @event PANOLENS.Viewer#window-resize
     * @property {number} width  - Width of the window
     * @property {number} height - Height of the window
     */
    this.dispatchEvent( { type: 'window-resize', width: width, height: height });

  };

  /**
   * Output infospot attach position in developer console by holding down Ctrl button
   */
  PANOLENS.Viewer.prototype.outputInfospotPosition = function () {

    var intersects, point;

    intersects = this.raycaster.intersectObject( this.panorama, true );

    if ( intersects.length > 0 ) {

      point = intersects[0].point.clone();

      console.info( '{ '
        + -point.x.toFixed(2) + ', '
        +  point.y.toFixed(2) + ', '
        +  point.z.toFixed(2) + ' }' );

    }

  };

  PANOLENS.Viewer.prototype.onMouseDown = function ( event ) {

    event.preventDefault();

    this.userMouse.x = ( event.clientX ) ? event.clientX : event.touches[0].clientX;
    this.userMouse.y = ( event.clientY ) ? event.clientY : event.touches[0].clientY;
    this.userMouse.type = 'mousedown';
    this.onTap( event );

  };

  PANOLENS.Viewer.prototype.onMouseMove = function ( event ) {

    event.preventDefault();
    this.userMouse.type = 'mousemove';
    this.onTap( event );

  };

  PANOLENS.Viewer.prototype.onMouseUp = function ( event ) {

    var onTarget = false, type;

    this.userMouse.type = 'mouseup';

    type = ( this.userMouse.x >= event.clientX - this.options.clickTolerance
        && this.userMouse.x <= event.clientX + this.options.clickTolerance
        && this.userMouse.y >= event.clientY - this.options.clickTolerance
        && this.userMouse.y <= event.clientY + this.options.clickTolerance )
        ||  ( event.changedTouches
        && this.userMouse.x >= event.changedTouches[0].clientX - this.options.clickTolerance
        && this.userMouse.x <= event.changedTouches[0].clientX + this.options.clickTolerance
        && this.userMouse.y >= event.changedTouches[0].clientY - this.options.clickTolerance
        && this.userMouse.y <= event.changedTouches[0].clientY + this.options.clickTolerance )
    ? 'click' : undefined;

    // Event should happen on canvas
    if ( event && event.target && !event.target.classList.contains( 'panolens-canvas' ) ) { return; }

    event.preventDefault();

    if ( event.changedTouches && event.changedTouches.length === 1 ) {

      onTarget = this.onTap( { clientX : event.changedTouches[0].clientX, clientY : event.changedTouches[0].clientY }, type );

    } else {

      onTarget = this.onTap( event, type );

    }

    this.userMouse.type = 'none';

    if ( onTarget ) {

      return;

    }

    if ( type === 'click' ) {

      this.options.autoHideInfospot && this.panorama && this.panorama.toggleInfospotVisibility();
      this.options.autoHideControlBar && this.toggleControlBar();

    }

  };

  PANOLENS.Viewer.prototype.onTap = function ( event, type ) {

    var intersects, intersect_entity, intersect;

    this.raycasterPoint.x = ( ( event.clientX - this.renderer.domElement.offsetLeft ) / this.renderer.domElement.clientWidth ) * 2 - 1;
      this.raycasterPoint.y = - ( ( event.clientY - this.renderer.domElement.offsetTop ) / this.renderer.domElement.clientHeight ) * 2 + 1;

    this.raycaster.setFromCamera( this.raycasterPoint, this.camera );

    // Return if no panorama
    if ( !this.panorama ) {

      return;

    }

    // output infospot information
    if ( this.OUTPUT_INFOSPOT ) {

      this.outputInfospotPosition();

    }

    intersects = this.raycaster.intersectObjects( this.panorama.children, true );

    intersect_entity = this.getConvertedIntersect( intersects );

    intersect = ( intersects.length > 0 ) ? intersects[0].object : intersect;

    if ( this.userMouse.type === 'mouseup'  ) {

      if ( intersect_entity && this.pressEntityObject === intersect_entity && this.pressEntityObject.dispatchEvent ) {

        this.pressEntityObject.dispatchEvent( { type: 'pressstop-entity', mouseEvent: event } );

      }

      this.pressEntityObject = undefined;

    }

    if ( this.userMouse.type === 'mouseup'  ) {

      if ( intersect && this.pressObject === intersect && this.pressObject.dispatchEvent ) {

        this.pressObject.dispatchEvent( { type: 'pressstop', mouseEvent: event } );

      }

      this.pressObject = undefined;

    }

    if ( type === 'click' ) {

      this.panorama.dispatchEvent( { type: 'click', intersects: intersects, mouseEvent: event } );

      if ( intersect_entity && intersect_entity.dispatchEvent ) {

        intersect_entity.dispatchEvent( { type: 'click-entity', mouseEvent: event } );

      }

      if ( intersect && intersect.dispatchEvent ) {

        intersect.dispatchEvent( { type: 'click', mouseEvent: event } );

      }

    } else {

      this.panorama.dispatchEvent( { type: 'hover', intersects: intersects, mouseEvent: event } );

      if ( ( this.hoverObject && intersects.length > 0 && this.hoverObject !== intersect_entity )
        || ( this.hoverObject && intersects.length === 0 ) ){

        if ( this.hoverObject.dispatchEvent ) {

          this.hoverObject.dispatchEvent( { type: 'hoverleave', mouseEvent: event } );

          // Reset reticle timer
          if ( this.reticle.timerId ) {
            window.cancelAnimationFrame( this.reticle.timerId );
            this.reticle.timerId = null;
          }

        }

        this.hoverObject = undefined;

      }

      if ( intersect_entity && intersects.length > 0 ) {

        if ( this.hoverObject !== intersect_entity ) {

          this.hoverObject = intersect_entity;

          if ( this.hoverObject.dispatchEvent ) {

            this.hoverObject.dispatchEvent( { type: 'hoverenter', mouseEvent: event } );

            // Start reticle timer
            if ( this.options.autoReticleSelect && this.options.enableReticle || this.tempEnableReticle ) {
              this.reticle.startTime = window.performance.now();
              this.reticle.timerId = window.requestAnimationFrame( this.reticleSelect.bind( this, event ) );
            }

          }

        }

        if ( this.userMouse.type === 'mousedown' && this.pressEntityObject != intersect_entity ) {

          this.pressEntityObject = intersect_entity;

          if ( this.pressEntityObject.dispatchEvent ) {

            this.pressEntityObject.dispatchEvent( { type: 'pressstart-entity', mouseEvent: event } );

          }

        }

        if ( this.userMouse.type === 'mousedown' && this.pressObject != intersect ) {

          this.pressObject = intersect;

          if ( this.pressObject.dispatchEvent ) {

            this.pressObject.dispatchEvent( { type: 'pressstart', mouseEvent: event } );

          }

        }

        if ( this.userMouse.type === 'mousemove' || this.options.enableReticle ) {

          if ( intersect && intersect.dispatchEvent ) {

            intersect.dispatchEvent( { type: 'hover', mouseEvent: event } );

          }

          if ( this.pressEntityObject && this.pressEntityObject.dispatchEvent ) {

            this.pressEntityObject.dispatchEvent( { type: 'pressmove-entity', mouseEvent: event } );

          }

          if ( this.pressObject && this.pressObject.dispatchEvent ) {

            this.pressObject.dispatchEvent( { type: 'pressmove', mouseEvent: event } );

          }

        }

      }

      if ( !intersect_entity && this.pressEntityObject && this.pressEntityObject.dispatchEvent ) {

        this.pressEntityObject.dispatchEvent( { type: 'pressstop-entity', mouseEvent: event } );

        this.pressEntityObject = undefined;

      }

      if ( !intersect && this.pressObject && this.pressObject.dispatchEvent ) {

        this.pressObject.dispatchEvent( { type: 'pressstop', mouseEvent: event } );

        this.pressObject = undefined;

      }

    }

    // Infospot handler
    if ( intersect && intersect instanceof PANOLENS.Infospot ) {

      this.infospot = intersect;

      if ( type === 'click' ) {

        return true;

      }


    } else if ( this.infospot ) {

      this.hideInfospot();

    }

  };

  PANOLENS.Viewer.prototype.getConvertedIntersect = function ( intersects ) {

    var intersect;

    for ( var i = 0; i < intersects.length; i++ ) {

      if ( intersects[i].object && !intersects[i].object.passThrough ) {

        if ( intersects[i].object.entity && intersects[i].object.entity.passThrough ) {
          continue;
        } else if ( intersects[i].object.entity && !intersects[i].object.entity.passThrough ) {
          intersect = intersects[i].object.entity;
          break;
        } else {
          intersect = intersects[i].object;
          break;
        }

      }

    }

    return intersect;

  };

  PANOLENS.Viewer.prototype.hideInfospot = function ( intersects ) {

    if ( this.infospot ) {

      this.infospot.onHoverEnd();

      this.infospot = undefined;

    }

  };

  /**
   * Toggle control bar
   * @fires [PANOLENS.Viewer#control-bar-toggle]
   */
  PANOLENS.Viewer.prototype.toggleControlBar = function () {

    /**
     * Toggle control bar event
     * @type {object}
     * @event PANOLENS.Viewer#control-bar-toggle
     */
    this.widget && this.widget.dispatchEvent( { type: 'control-bar-toggle' } );

  };

  PANOLENS.Viewer.prototype.onKeyDown = function ( event ) {

    if ( event.keyCode === 17 || event.keyIdentifier === 'Control' ) {

      this.OUTPUT_INFOSPOT = true;

    }

  };

  PANOLENS.Viewer.prototype.onKeyUp = function ( event ) {

    this.OUTPUT_INFOSPOT = false;

  };

  /**
   * Update control and callbacks
   */
  PANOLENS.Viewer.prototype.update = function () {

    TWEEN.update();

    this.updateCallbacks.forEach( function( callback ){ callback(); } );

    !this.options.passiveRendering && this.control.update();

  };

  /**
   * Rendering function to be called on every animation frame
   */
  PANOLENS.Viewer.prototype.render = function () {

    if ( this.mode === PANOLENS.Modes.VR ) {

      this.effect.render( this.scene, this.camera );

    } else {

      this.renderer.render( this.scene, this.camera );

    }

  };

  PANOLENS.Viewer.prototype.animate = function () {

    this.requestAnimationId = window.requestAnimationFrame( this.animate.bind( this ) );

    this.update();

        !this.options.passiveRendering && this.render();

  };

  PANOLENS.Viewer.prototype.onChange = function () {

    this.update();
        this.render();

  };

  /**
   * Register mouse and touch event on container
   */
  PANOLENS.Viewer.prototype.registerMouseAndTouchEvents = function () {

    this.container.addEventListener( 'mousedown' ,   this.HANDLER_MOUSE_DOWN, true );
    this.container.addEventListener( 'mousemove' ,   this.HANDLER_MOUSE_MOVE, true );
    this.container.addEventListener( 'mouseup'   ,   this.HANDLER_MOUSE_UP  , true );
    this.container.addEventListener( 'touchstart',   this.HANDLER_MOUSE_DOWN, true );
    this.container.addEventListener( 'touchend'  ,   this.HANDLER_MOUSE_UP  , true );

  };

  /**
   * Unregister mouse and touch event on container
   */
  PANOLENS.Viewer.prototype.unregisterMouseAndTouchEvents = function () {

    this.container.removeEventListener( 'mousedown' ,  this.HANDLER_MOUSE_DOWN, true );
    this.container.removeEventListener( 'mousemove' ,  this.HANDLER_MOUSE_MOVE, true );
    this.container.removeEventListener( 'mouseup'  ,  this.HANDLER_MOUSE_UP  , true );
    this.container.removeEventListener( 'touchstart',  this.HANDLER_MOUSE_DOWN, true );
    this.container.removeEventListener( 'touchend'  ,  this.HANDLER_MOUSE_UP  , true );
  };

  /**
   * Reticle selection
   * @param  {object} mouseEvent - Mouse event to be passed in
   */
  PANOLENS.Viewer.prototype.reticleSelect = function ( mouseEvent ) {

    var reticle = this.reticle;

    if ( performance.now() - reticle.startTime >= this.options.dwellTime ) {

      // Reticle select
      this.onTap( mouseEvent, 'click' );

      window.cancelAnimationFrame( reticle.timerId );
      reticle.timerId = null;


    } else if ( this.options.autoReticleSelect ){

      reticle.timerId = window.requestAnimationFrame( this.reticleSelect.bind( this, mouseEvent ) );

    }

  }

  /**
   * Register reticle event
   */
  PANOLENS.Viewer.prototype.registerReticleEvent = function () {

    this.addUpdateCallback( this.HANDLER_TAP );

  };

  /**
   * Unregister reticle event
   */
  PANOLENS.Viewer.prototype.unregisterReticleEvent = function () {

    this.removeUpdateCallback( this.HANDLER_TAP );

  };

  /**
   * Update reticle event
   */
  PANOLENS.Viewer.prototype.updateReticleEvent = function ( mode ) {

    var centerX, centerY;

    centerX = this.container.clientWidth / 2;
    centerY = this.container.clientHeight / 2;

    this.removeUpdateCallback( this.HANDLER_TAP );
    this.HANDLER_TAP = this.onTap.bind( this, { clientX: centerX, clientY: centerY } );
    this.addUpdateCallback( this.HANDLER_TAP );

  };

  /**
   * Register container and window listeners
   */
  PANOLENS.Viewer.prototype.registerEventListeners = function () {

    // Resize Event
    window.addEventListener( 'resize' , this.HANDLER_WINDOW_RESIZE, true );

    // Keyboard Event
    window.addEventListener( 'keydown', this.HANDLER_KEY_DOWN, true );
    window.addEventListener( 'keyup'  , this.HANDLER_KEY_UP   , true );

  };

  /**
   * Unregister container and window listeners
   */
  PANOLENS.Viewer.prototype.unregisterEventListeners = function () {

    // Resize Event
    window.removeEventListener( 'resize' , this.HANDLER_WINDOW_RESIZE, true );

    // Keyboard Event
    window.removeEventListener( 'keydown', this.HANDLER_KEY_DOWN, true );
    window.removeEventListener( 'keyup'  , this.HANDLER_KEY_UP  , true );

  };

  /**
   * Dispose all scene objects and clear cache
   */
  PANOLENS.Viewer.prototype.dispose = function () {

    // Unregister dom event listeners
    this.unregisterEventListeners();

    // recursive disposal on 3d objects
    function recursiveDispose ( object ) {

      for ( var i = object.children.length - 1; i >= 0; i-- ) {

        recursiveDispose( object.children[i] );
        object.remove( object.children[i] );

      }

      if ( object instanceof PANOLENS.Infospot ) {

        object.dispose();

      }

      object.geometry && object.geometry.dispose();
      object.material && object.material.dispose();
    }

    recursiveDispose( this.scene );

    // dispose widget
    if ( this.widget ) {

      this.widget.dispose();
      this.widget = null;

    }

    // clear cache
    if ( THREE.Cache && THREE.Cache.enabled ) {

      THREE.Cache.clear();

    }

  };

  /**
   * Destory viewer by disposing and stopping requestAnimationFrame
   */
  PANOLENS.Viewer.prototype.destory = function () {

    this.dispose();
    this.render();
    window.cancelAnimationFrame( this.requestAnimationId );

  };

} )();