import * as THREE from 'three';
import { events } from './core/event-bus';
import { createRenderer } from './renderer';
import { FirstPersonControls } from './controls/first-person';
import { Terrain } from './world/terrain';
import { Water } from './world/water';
import { SkyDome } from './world/sky';
import { Vegetation } from './world/vegetation';
import { Sun } from './lighting/sun';
import { createAmbientLight } from './lighting/ambient';
import { HUD } from './ui/hud';
import { Crosshair } from './ui/crosshair';
import { PlayerState } from './player/player-state';
import { StatusBars } from './ui/status-bars';
import { InteractionSystem } from './systems/interaction';
import { InteractionPrompt } from './ui/interaction-prompt';
import { Inventory } from './systems/inventory';
import { InventoryUI } from './ui/inventory-ui';
import { CraftingSystem } from './systems/crafting';
import { CraftingUI } from './ui/crafting-ui';
import { ToolSystem } from './systems/tool-system';
import { ResourceManager } from './world/resources';
import { DayCycle } from './systems/day-cycle';
import { PlaceableManager } from './world/placeables';
import { PlacementSystem } from './systems/placement';
import { AnimalSystem } from './systems/animal-system';
import { WeatherSystem } from './systems/weather-system';
import { Rain } from './world/rain';
import { AudioSystem } from './systems/audio-system';
import { StorageUI } from './ui/storage-ui';
import { SleepOverlay } from './ui/sleep-overlay';
import { Clouds } from './world/clouds';
import { LightningBolt } from './world/lightning';
import { Stars } from './world/stars';
import { Moon } from './world/moon';
import { SaveSystem, type SaveData } from './systems/save-system';
import { SaveUI } from './ui/save-ui';
import { PostProcessing } from './rendering/post-processing';
import { ArmorSystem } from './systems/armor-system';
import { ProjectileSystem } from './systems/projectile-system';
import { Shipwreck } from './world/shipwreck';
import { Minimap } from './ui/minimap';
import { ObjectiveTracker } from './ui/objectives';
import { GameConsole } from './ui/console';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  camera: THREE.PerspectiveCamera; // public for debug
  private clock: THREE.Clock;
  private controls: FirstPersonControls;
  private terrain: Terrain;
  private water: Water;
  private sun: Sun;
  private ambient: THREE.HemisphereLight;
  private hud: HUD;
  private crosshair: Crosshair;
  private playerState: PlayerState;
  private interactionSystem: InteractionSystem;
  private inventory: Inventory;
  private inventoryUI: InventoryUI;
  private craftingUI: CraftingUI;
  private toolSystem: ToolSystem;
  private resourceManager: ResourceManager;
  dayCycle: DayCycle; // public for debug
  private placeableManager: PlaceableManager;
  private placementSystem: PlacementSystem;
  private animalSystem: AnimalSystem;
  weatherSystem: WeatherSystem; // public for debug access
  private rain: Rain;
  private audioSystem: AudioSystem;
  private sleepOverlay: SleepOverlay;
  private clouds: Clouds;
  private lightning: LightningBolt;
  stars: Stars;        // public for debug
  moonDisc: Moon;      // public for debug
  private skyDome: SkyDome;
  private screenOverlayScene: THREE.Scene;
  private screenOverlayCamera: THREE.OrthographicCamera;
  private saveSystem: SaveSystem;
  private saveUI: SaveUI;
  private postProcessing: PostProcessing;
  private armorSystem: ArmorSystem;
  private projectileSystem: ProjectileSystem;
  private shipwreck: Shipwreck;
  private minimap: Minimap;
  private objectives: ObjectiveTracker;
  private saveTimer = 0;
  private uiOpen = false;
  private springPos = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.003);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 20, 0);
    this.scene.add(this.camera);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });

    this.clock = new THREE.Clock();

    // Controls
    this.controls = new FirstPersonControls(this.camera, canvas);
    this.crosshair = new Crosshair();
    this.controls.controls.addEventListener('lock', () => this.crosshair.show());
    this.controls.controls.addEventListener('unlock', () => this.crosshair.hide());

    // World
    this.terrain = new Terrain();
    this.scene.add(this.terrain.mesh);
    this.controls.setHeightProvider((x, z) => this.terrain.getHeightAt(x, z));

    this.water = new Water();
    this.scene.add(this.water.mesh);

    this.skyDome = new SkyDome();
    this.scene.add(this.skyDome.sky);

    this.sun = new Sun(this.skyDome.sunPosition);
    this.scene.add(this.sun.light);
    this.scene.add(this.sun.light.target);
    this.ambient = createAmbientLight();
    this.scene.add(this.ambient);

    const vegetation = new Vegetation(this.terrain);
    this.scene.add(vegetation.group);

    // Player
    this.playerState = new PlayerState();
    new StatusBars(this.playerState);

    // Interaction
    this.interactionSystem = new InteractionSystem(this.camera);
    new InteractionPrompt();

    // Inventory & crafting
    this.inventory = new Inventory(24);
    this.inventoryUI = new InventoryUI(this.inventory, this.playerState);
    const craftingSystem = new CraftingSystem(this.inventory);
    this.craftingUI = new CraftingUI(craftingSystem, this.inventory);

    // Tools
    this.toolSystem = new ToolSystem(this.inventory, this.camera);

    // Resources
    this.resourceManager = new ResourceManager(this.terrain, this.scene, this.interactionSystem, this.inventory);

    // Day/night
    this.dayCycle = new DayCycle(this.sun, this.skyDome, this.ambient, this.scene, this.renderer);

    // Placeables
    this.placeableManager = new PlaceableManager(this.scene, this.interactionSystem, this.inventory, this.playerState);
    this.placementSystem = new PlacementSystem(this.camera, this.terrain, this.scene, this.inventory, this.placeableManager);

    // Animals
    this.animalSystem = new AnimalSystem(this.terrain, this.scene, this.camera, this.inventory, this.placeableManager);

    // Weather + rain + clouds + lightning
    this.weatherSystem = new WeatherSystem(this.dayCycle);
    this.rain = new Rain();
    this.scene.add(this.rain.mesh);       // world-space streaks
    this.scene.add(this.rain.splashes);   // ground splash particles
    this.clouds = new Clouds(this.renderer);
    this.scene.add(this.clouds.mesh);
    this.lightning = new LightningBolt(this.scene);
    this.stars = new Stars();
    this.scene.add(this.stars.mesh);
    this.moonDisc = new Moon(); // renders as HTML overlay, not in Three.js scene

    // Persistent screen overlay scene for rain post-pass
    this.screenOverlayScene = new THREE.Scene();
    this.screenOverlayScene.add(this.rain.screenQuad);
    this.screenOverlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Audio
    this.audioSystem = new AudioSystem();

    // Storage UI
    new StorageUI(this.inventory);

    // Sleep overlay
    this.sleepOverlay = new SleepOverlay();

    // HUD
    this.hud = new HUD();

    // Post-processing (bloom)
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);

    // Combat systems
    this.armorSystem = new ArmorSystem(this.inventory);
    this.projectileSystem = new ProjectileSystem(this.scene);

    // Shipwreck POI
    this.shipwreck = new Shipwreck(this.terrain, this.scene, this.interactionSystem, this.inventory);

    // Minimap
    this.minimap = new Minimap(this.terrain, this.placeableManager);

    // Objectives
    this.objectives = new ObjectiveTracker(this.inventory, this.dayCycle);
    this.objectives.listenPlaceables();

    // Armor intercepts damage before PlayerState applies it
    // Override the event: PlayerState listens for player:take-damage,
    // but we intercept with player:raw-damage first
    events.on('player:raw-damage', (amount: number) => {
      const reduced = this.armorSystem.reduceDamage(amount);
      events.emit('player:take-damage', reduced);
    });

    // Debug console
    new GameConsole(this.dayCycle, this.playerState, this.inventory, this.weatherSystem);

    // --- Event wiring ---
    // UI state
    const uiOpen = (name: string) => {
      events.on(`${name}:opened`, () => { this.uiOpen = true; this.controls.controls.unlock(); });
      events.on(`${name}:closed`, () => { this.uiOpen = false; this.controls.controls.lock(); });
    };
    uiOpen('inventory');
    uiOpen('crafting');
    uiOpen('actionmenu');
    uiOpen('storage');

    uiOpen('console');

    events.on('console:teleport', (x: number, z: number) => {
      const y = this.terrain.getHeightAt(x, z) + 2;
      this.camera.position.set(x, y, z);
    });
    events.on('console:speed', (spd: number) => {
      (this.controls as any).walkSpeed = spd;
      (this.controls as any).sprintSpeed = spd * 1.7;
    });

    // Hurt flash — red overlay when taking damage
    const hurtOverlay = document.createElement('div');
    hurtOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(200,0,0,0.3); pointer-events: none; z-index: 8;
      opacity: 0; transition: opacity 0.1s ease;
    `;
    document.body.appendChild(hurtOverlay);
    events.on('player:hurt-flash', () => {
      hurtOverlay.style.opacity = '1';
      setTimeout(() => { hurtOverlay.style.opacity = '0'; }, 150);
    });

    events.on('console:save', () => this.saveGame());
    events.on('console:deletesave', () => this.saveSystem.deleteSave());
    events.on('notification', (msg: string) => this.hud.showNotification(msg));
    events.on('tool:broke', () => this.hud.showNotification('Tool broke!'));

    // Temperature from weather
    events.on('weather:temperature', (mult: number) => {
      this.playerState.temperatureMultiplier = mult;
    });

    // Sleep
    events.on('sleep:start', () => this.handleSleep());

    // E key to consume food from hotbar
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !this.uiOpen && this.controls.isLocked) {
        if (!this.interactionSystem.getCurrent()) {
          const hotbarSlot = this.inventoryUI.getEquippedHotbarSlot();
          if (hotbarSlot >= 0) {
            this.inventoryUI.consumeSlot(hotbarSlot);
          }
        }
      }
    });

    // Fresh water spring
    this.createFreshWaterSpring();

    // Save system
    this.saveSystem = new SaveSystem();
    this.saveUI = new SaveUI();

    // Load existing save or run debug setup
    if (this.saveSystem.hasSave()) {
      const save = this.saveSystem.load();
      if (save) {
        this.applySave(save);
      }
    } else {
      this.debugSetup();
    }

    // Auto-save on page unload
    window.addEventListener('beforeunload', () => this.saveGame());

    // Instructions
    this.createInstructions(canvas);
  }

  private async handleSleep() {
    if (this.dayCycle.getPhase() !== 'night' && this.dayCycle.getPhase() !== 'dusk') {
      events.emit('notification', 'Can only sleep at night');
      return;
    }

    // Calculate time to skip
    const currentTime = this.dayCycle.getTime();
    const morningTime = 0.3;
    const timeToSkip = currentTime > morningTime
      ? (1 - currentTime + morningTime)
      : (morningTime - currentTime);
    const secondsSkipped = timeToSkip * this.dayCycle.getDayDuration();

    await this.sleepOverlay.fadeToBlack();

    this.dayCycle.setTime(morningTime);
    this.playerState.advanceTime(secondsSkipped);
    this.playerState.modifyStat('stamina', 100);
    this.playerState.modifyStat('health', 10); // slight health regen from rest

    await this.sleepOverlay.fadeIn();
    events.emit('notification', 'You feel rested');
  }

  private createInstructions(canvas: HTMLCanvasElement) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.5); z-index: 20;
      font-family: sans-serif; color: #fff; text-align: center;
      cursor: pointer;
    `;
    overlay.innerHTML = `
      <div>
        <h1 style="font-size: 2em; margin-bottom: 0.5em;">FP Survival</h1>
        <p style="font-size: 1.2em;">Click to play</p>
        <p style="margin-top: 1em; opacity: 0.7;">
          WASD to move &bull; Shift to sprint &bull; Mouse to look<br>
          E to interact &bull; Left-click to attack &bull; Tab for inventory<br>
          C for crafting &bull; 1-6 for hotbar &bull; M toggle sound &bull; ESC to pause
        </p>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => this.controls.controls.lock());
    this.controls.controls.addEventListener('lock', () => { overlay.style.display = 'none'; });
    this.controls.controls.addEventListener('unlock', () => {
      if (!this.uiOpen) overlay.style.display = 'flex';
    });
  }

  private debugSetup() {
    this.inventory.addItem('stone_axe', 1);
    this.inventory.addItem('stone_pickaxe', 1);
    this.inventory.addItem('fishing_spear', 1);
    this.inventory.addItem('bow', 1);
    this.inventory.addItem('arrow', 10);
    this.inventory.addItem('hide_armor', 1);
    this.inventory.addItem('bone_club', 1);
    this.inventory.addItem('campfire_item', 2);
    this.inventory.addItem('shelter_item', 1);
    this.inventory.addItem('storage_box_item', 1);
    this.inventory.addItem('water_collector_item', 1);
    this.inventory.addItem('rope', 5);
    this.inventory.addItem('coconut', 5);
    this.inventory.addItem('cooked_coconut', 3);
    this.inventory.addItem('coconut_shell', 3);
    this.inventory.addItem('water_bottle', 2);
    this.inventory.addItem('dirty_water', 3);
    this.inventory.addItem('clean_water', 3);
    this.inventory.addItem('wood', 10);
    this.inventory.addItem('stone', 10);
    this.inventory.addItem('stick', 10);
    this.inventory.addItem('fiber', 10);

    setTimeout(() => {
      const campfirePos = this.springPos.clone();
      campfirePos.x += 5;
      campfirePos.z += 3;
      campfirePos.y = this.terrain.getHeightAt(campfirePos.x, campfirePos.z);
      this.placeableManager.place('campfire', campfirePos);

      this.camera.position.set(this.springPos.x + 8, this.springPos.y + 2, this.springPos.z + 8);
    }, 0);
  }

  private createFreshWaterSpring() {
    let springX = 30, springZ = -25;
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = (Math.random() - 0.5) * 120;
      const z = (Math.random() - 0.5) * 120;
      const h = this.terrain.getHeightAt(x, z);
      if (h > 8 && h < 20) { springX = x; springZ = z; break; }
    }

    const springY = this.terrain.getHeightAt(springX, springZ);
    this.springPos.set(springX, springY, springZ);

    const pondGeo = new THREE.CircleGeometry(3, 24);
    pondGeo.rotateX(-Math.PI / 2);
    const pond = new THREE.Mesh(pondGeo, new THREE.MeshStandardMaterial({
      color: 0x3399aa, transparent: true, opacity: 0.65, roughness: 0.1, metalness: 0.2,
    }));
    pond.position.set(springX, springY + 0.1, springZ);
    this.scene.add(pond);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x556655, roughness: 0.9 });
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const r = 2.8 + Math.random() * 0.8;
      const rock = new THREE.Mesh(new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 5, 4), rockMat);
      rock.scale.y = 0.5;
      rock.position.set(springX + Math.cos(angle) * r, springY + 0.1, springZ + Math.sin(angle) * r);
      rock.castShadow = true;
      this.scene.add(rock);
    }

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(3, 6, 6),
      new THREE.MeshStandardMaterial({ visible: false })
    );
    marker.position.set(springX, springY + 1, springZ);
    this.scene.add(marker);

    this.interactionSystem.register({
      type: 'water_source',
      promptText: 'Fill container with fresh water',
      mesh: marker,
      onInteract: () => {
        const hasShell = this.inventory.hasItem('coconut_shell');
        const hasBottle = this.inventory.hasItem('water_bottle');
        if (!hasShell && !hasBottle) {
          events.emit('notification', 'Need a coconut shell or plastic bottle');
          return;
        }
        if (hasShell) this.inventory.removeItem('coconut_shell', 1);
        else this.inventory.removeItem('water_bottle', 1);
        this.inventory.addItem('dirty_water', 1);
        events.emit('notification', 'Filled container with fresh water (boil to purify)');
      },
    });
  }

  start() {
    this.clock.start();
    this.loop();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);

    this.controls.enabled = !this.uiOpen;
    this.interactionSystem.setEnabled(!this.uiOpen && this.controls.isLocked);

    if (this.playerState.stamina <= 0) this.controls.setCanSprint(false);

    // Update all systems
    this.controls.update(dt);
    this.playerState.update(dt, this.controls.isSprinting);
    this.interactionSystem.update(dt);
    this.toolSystem.update(dt);
    this.resourceManager.update(dt);
    this.animalSystem.update(dt);
    this.projectileSystem.update(dt);
    this.dayCycle.update(dt);
    this.weatherSystem.update(dt);
    this.rain.update(dt, this.camera.position, this.weatherSystem.getIntensity(), this.weatherSystem.getWindStrength(), this.camera);
    this.lightning.update(dt, this.camera.position);
    this.water.update(dt);
    this.placeableManager.update(dt);
    this.placementSystem.update(dt);
    this.sun.followPlayer(this.camera.position);
    this.dayCycle.followPlayer(this.camera.position);

    // Stars and moon
    const sunElev = this.dayCycle.getSunElevation();
    this.stars.update(dt, sunElev, this.weatherSystem.getCloudCoverage());
    this.stars.follow(this.camera.position);
    this.moonDisc.update(
      this.dayCycle.getDay(), this.dayCycle.getTime(),
      sunElev, this.camera.position, this.camera
    );

    // Volumetric clouds — render to half-res target, then composite
    const cloudCoverage = this.weatherSystem.getCloudCoverage();
    const windStrength = this.weatherSystem.getWindStrength();
    const rainIntensity = this.weatherSystem.getIntensity();
    this.clouds.setCoverage(cloudCoverage);
    this.clouds.setWindStrength(windStrength);
    this.clouds.setDarkness(rainIntensity);
    this.clouds.setSunDirection(this.sun.light.position.clone().normalize());
    this.clouds.setSunColor(this.sun.light.color);
    this.clouds.update(dt, this.camera.position);
    this.clouds.render(this.renderer, this.camera);
    this.skyDome.setOvercast(cloudCoverage);

    // Weather effects on sun and fog
    const sunDim = this.weatherSystem.getSunDimming();
    this.sun.light.intensity *= sunDim;

    // Sunny: boost exposure
    if (this.weatherSystem.getType() === 'clear' && this.dayCycle.getSunElevation() > 10) {
      this.renderer.toneMappingExposure = Math.min(this.renderer.toneMappingExposure * 1.15, 0.75);
    }

    // Cloudy/rain: desaturate ambient
    if (this.weatherSystem.getType() !== 'clear') {
      const grey = cloudCoverage * 0.4;
      this.ambient.intensity *= (1 - grey * 0.3);
    }

    // Lightning flash — spike ambient
    const flash = this.weatherSystem.getLightningFlash();
    if (flash > 0) {
      this.ambient.intensity += flash * 3.0;
      this.renderer.toneMappingExposure += flash * 0.5;
    }

    // Update terrain time uniform for caustics animation
    const terrainMat = this.terrain.mesh.material as any;
    if (terrainMat._terrainUniforms) {
      terrainMat._terrainUniforms.uTime.value += dt;
    }

    // Wet surface effect — terrain gets shinier when raining
    if (rainIntensity > 0.05) {
      terrainMat.roughness = 0.85 - rainIntensity * 0.45;
      terrainMat.metalness = rainIntensity * 0.25;
    } else {
      terrainMat.roughness = 0.85;
      terrainMat.metalness = 0.0;
    }

    // Fog — multiplied by weather
    const fog = this.scene.fog as THREE.FogExp2;
    if (fog) {
      const baseFog = 0.003;
      fog.density = Math.max(fog.density, baseFog * this.weatherSystem.getFogMultiplier());
    }

    // Storm shake — applied as slight camera position jitter (not rotation)
    const shake = this.weatherSystem.getCameraShake();
    if (shake > 0.001) {
      const t = performance.now() * 0.001;
      this.camera.position.x += Math.sin(t * 4.3) * shake * 0.08;
      this.camera.position.z += Math.cos(t * 3.1) * shake * 0.06;
    }

    // Audio
    this.audioSystem.updateAmbient(
      this.weatherSystem.getIntensity(),
      this.dayCycle.getPhase() === 'night'
    );

    // Auto-save every 60 seconds
    this.saveTimer += dt;
    if (this.saveTimer >= 60) {
      this.saveTimer = 0;
      this.saveGame();
    }

    // Minimap
    this.minimap.update(dt, this.camera.position.x, this.camera.position.z, this.camera.rotation.y);

    // Bloom modulation: brighter during lightning, subtler during rain
    let bloomStr = 0.4;
    if (flash > 0) bloomStr += flash * 1.5;
    if (rainIntensity > 0.3) bloomStr *= (1 - rainIntensity * 0.5);
    this.postProcessing.setBloomStrength(bloomStr);

    const pos = this.camera.position;
    this.hud.update(pos.x, pos.y, pos.z, this.dayCycle.getTimeString());

    this.postProcessing.render(dt);

    // Screen-space rain overlay (composited on top)
    if (this.rain.screenQuad.visible) {
      this.renderer.autoClear = false;
      this.renderer.render(this.screenOverlayScene, this.screenOverlayCamera);
    }

    this.renderer.autoClear = true;
  };

  private saveGame() {
    const pos = this.camera.position;
    const data: SaveData = {
      version: 1,
      timestamp: Date.now(),
      player: {
        position: [pos.x, pos.y, pos.z],
        ...this.playerState.serialize(),
      },
      inventory: { slots: this.inventory.serialize() },
      time: this.dayCycle.serialize(),
      placeables: this.placeableManager.serialize(),
      resources: this.resourceManager.serialize(),
      animals: this.animalSystem.serialize(),
      weather: this.weatherSystem.serialize(),
      shipwreck: this.shipwreck.serialize(),
      objectives: { completedIndex: this.objectives.getCompletedIndex() },
    } as any;
    this.saveSystem.save(data);
    this.saveUI.flash();
  }

  private applySave(data: SaveData) {
    // Player position
    this.camera.position.set(data.player.position[0], data.player.position[1], data.player.position[2]);

    // Player stats
    this.playerState.deserialize(data.player);

    // Inventory
    this.inventory.deserialize(data.inventory.slots);

    // Time
    this.dayCycle.deserialize(data.time);

    // Weather
    this.weatherSystem.deserialize(data.weather);

    // Resources (depleted nodes)
    this.resourceManager.deserialize(data.resources);

    // Animals
    if (data.animals) {
      this.animalSystem.deserialize(data.animals);
    }

    // Placeables (campfires, shelters, storage boxes, water collectors)
    if (data.placeables) {
      this.placeableManager.deserializePlaceables(data.placeables);
    }

    // Shipwreck loot state
    if ((data as any).shipwreck) {
      this.shipwreck.deserialize((data as any).shipwreck);
    }

    // Objectives progress
    if ((data as any).objectives) {
      this.objectives.setCompletedIndex((data as any).objectives.completedIndex);
    }
  }
}
