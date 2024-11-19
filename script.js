(function () {
  // Set our main variables
  let scene,
    renderer,
    camera,
    model, // Our character
    neck, // Reference to the neck bone in the skeleton
    waist, // Reference to the waist bone in the skeleton
    possibleAnims, // Animations found in our file
    mixer, // THREE.js animations mixer
    idle, // Idle, the default state our character returns to
    clock = new THREE.Clock(), // Used for anims, which run to a clock instead of frame rate
    currentlyAnimating = false, // Used to check whether characters neck is being used in another anim
    raycaster = new THREE.Raycaster(), // Used to detect the click on our character
    loaderAnim = document.getElementById('js-loader');

  init();

  function init() {
    const MODEL_PATH =
      'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1376484/stacy_lightweight.glb';
    const canvas = document.querySelector('#c');
    const backgroundColor = 0xf1f1f1;

    // Init the scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 60, 100);

    // Init the renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Add a camera
    camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, -3, 30);

    const stacyTexture = new THREE.TextureLoader().load(
      'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1376484/stacy.jpg'
    );
    stacyTexture.flipY = false;

    const stacyMaterial = new THREE.MeshPhongMaterial({
      map: stacyTexture,
      color: 0xffffff,
      skinning: true,
    });

    loadModel(MODEL_PATH, stacyMaterial);
    addLights();
    addFloor();
    addSphere();

    // Start the animation loop
    update();
  }

  function loadModel(modelPath, material) {
    const loader = new THREE.GLTFLoader();

    loader.load(
      modelPath,
      (gltf) => {
        model = gltf.scene;
        const fileAnimations = gltf.animations;

        model.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            object.material = material;
          }

          // Reference the neck and waist bones
          if (object.isBone) {
            if (object.name === 'mixamorigNeck') neck = object;
            if (object.name === 'mixamorigSpine') waist = object;
          }
        });

        model.scale.set(7, 7, 7);
        model.position.y = -11;

        scene.add(model);
        loaderAnim.remove();

        mixer = new THREE.AnimationMixer(model);

        const clips = fileAnimations.filter((clip) => clip.name !== 'idle');
        possibleAnims = clips.map((clip) => {
          const clipAction = THREE.AnimationClip.findByName(clips, clip.name);
          clipAction.tracks.splice(3, 3);
          clipAction.tracks.splice(9, 3);
          return mixer.clipAction(clipAction);
        });

        const idleAnim = THREE.AnimationClip.findByName(fileAnimations, 'idle');
        idleAnim.tracks.splice(3, 3);
        idleAnim.tracks.splice(9, 3);
        idle = mixer.clipAction(idleAnim);
        idle.play();
      },
      undefined, // Progress function not needed
      (error) => console.error(error)
    );
  }

  function addLights() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.61);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.54);
    dirLight.position.set(-8, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 1500;
    const d = 8.25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);
  }

  function addFloor() {
    const floorGeometry = new THREE.PlaneGeometry(5000, 5000);
    const floorMaterial = new THREE.MeshPhongMaterial({
      color: 0xeeeeee,
      shininess: 0,
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.position.y = -11;
    scene.add(floor);
  }

  function addSphere() {
    const geometry = new THREE.SphereGeometry(8, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x9bffaf });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(-0.25, -2.5, -15);
    scene.add(sphere);
  }

  function update() {
    requestAnimationFrame(update);

    if (mixer) mixer.update(clock.getDelta());

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
  }

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const canvasPixelWidth = canvas.width / window.devicePixelRatio;
    const canvasPixelHeight = canvas.height / window.devicePixelRatio;

    const needResize =
      canvasPixelWidth !== width || canvasPixelHeight !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  window.addEventListener('click', (e) => raycast(e));
  window.addEventListener('touchend', (e) => raycast(e, true));

  function raycast(e, touch = false) {
    const mouse = {};
    if (touch) {
      mouse.x = (2 * e.changedTouches[0].clientX) / window.innerWidth - 1;
      mouse.y = 1 - (2 * e.changedTouches[0].clientY) / window.innerHeight;
    } else {
      mouse.x = (2 * e.clientX) / window.innerWidth - 1;
      mouse.y = 1 - (2 * e.clientY) / window.innerHeight;
    }
    // update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0 && intersects[0].object.name === 'stacy') {
      if (!currentlyAnimating) {
        currentlyAnimating = true;
        playOnClick();
      }
    }
  }

  // Get a random animation, and play it
  function playOnClick() {
    const animIndex = Math.floor(Math.random() * possibleAnims.length);
    playModifierAnimation(idle, 0.25, possibleAnims[animIndex], 0.25);
  }

  function playModifierAnimation(from, fSpeed, to, tSpeed) {
    to.setLoop(THREE.LoopOnce);
    to.reset();
    to.play();
    from.crossFadeTo(to, fSpeed, true);
    setTimeout(() => {
      from.enabled = true;
      to.crossFadeTo(from, tSpeed, true);
      currentlyAnimating = false;
    }, to._clip.duration * 1000 - (tSpeed + fSpeed) * 1000);
  }

  document.addEventListener('mousemove', (e) => {
    const mousecoords = getMousePos(e);
    if (neck && waist) {
      moveJoint(mousecoords, neck, 50);
      moveJoint(mousecoords, waist, 30);
    }
  });

  function getMousePos(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function moveJoint(mouse, joint, degreeLimit) {
    const degrees = getMouseDegrees(mouse.x, mouse.y, degreeLimit);
    joint.rotation.y = THREE.Math.degToRad(degrees.x);
    joint.rotation.x = THREE.Math.degToRad(degrees.y);
  }

  function getMouseDegrees(x, y, degreeLimit) {
    const w = { x: window.innerWidth, y: window.innerHeight };

    let dx = 0;
    let dy = 0;

    // Calculate x and y differences and percentages
    const xdiff = w.x / 2 - x;
    const xPercentage = Math.abs((xdiff / (w.x / 2)) * 100);
    dx = (degreeLimit * xPercentage) / 100;
    if (x < w.x / 2) dx *= -1;

    const ydiff = w.y / 2 - y;
    const yPercentage = Math.abs((ydiff / (w.y / 2)) * 100);
    dy = ((degreeLimit * 0.5 * yPercentage) / 100) * (y > w.y / 2 ? 1 : -1);

    return { x: dx, y: dy };
  }
})();
