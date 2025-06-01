/**
 * Daily Quests Manager - Fixed Version
 * 
 * This file contains the core logic for the Daily Quests Manager feature.
 * It handles quest detection, execution, and state management.
 * 
 * The UI elements and event handlers are defined in uncodedeeee.js.
 * The quest locations are defined in daily_quests_locations.js.
 * 
 * FIXES:
 * - Uses questProceed() for NPC interaction with proper looping
 * - Checks for RESP/PVP/LPVM/RES existence before stopping them
 */

// Define UI update functions first to ensure they're available globally
window.updateDailyQuestsUI = function() {
  window.updateQuestsList();
  window.updateProgressCounter();
};

window.updateQuestsList = function() {
  const $list = $('#dq_locations_list');
  $list.empty();
  
  if (!window.DAILY_QUESTS || !window.DAILY_QUESTS.locations) return;
  
  window.DAILY_QUESTS.locations.forEach((location, index) => {
    const $location = $('<div class="dq_location"></div>');
    $location.data('index', index);
    
    // Add toggle checkbox
    const $toggle = $('<input type="checkbox" class="dq_location_toggle">');
    $toggle.prop('checked', !location.disabled);
    $location.append($toggle);
    
    // Add location name
    const $name = $('<div class="dq_location_name"></div>').text(location.name);
    if (location.completed) {
      $name.addClass('completed');
    }
    if (window.DAILY_QUESTS.runtime.currentLocationIndex === index && window.DAILY_QUESTS.settings.active) {
      $location.addClass('active');
    }
    $location.append($name);
    
    // Add status indicator
    const $status = $('<div class="dq_location_status"></div>');
    if (location.completed) {
      $status.text('✓');
      $status.css('color', 'green');
    } else if (location.disabled) {
      $status.text('✗');
      $status.css('color', 'red');
    } else {
      $status.text('○');
      $status.css('color', 'white');
    }
    $location.append($status);
    
    $list.append($location);
  });
};

window.updateProgressCounter = function() {
  if (!window.DAILY_QUESTS || !window.DAILY_QUESTS.locations) return;
  
  const total = window.DAILY_QUESTS.locations.length;
  const completed = window.DAILY_QUESTS.locations.filter(loc => loc.completed).length;
  $('#dq_progress_count').text(completed + '/' + total);
};

window.setStatusMessage = function(message) {
  $('#dq_status_message').text(message);
};

// Define constants
const QUEST_FLOW_STATES = {
  IDLE: "idle",
  TELEPORTING: "teleporting",
  MOVING_TO_START: "moving_to_start",
  INTERACTING_START: "interacting_start",
  DETECTING_QUEST: "detecting_quest",
  EXECUTING_QUEST: "executing_quest",
  MOVING_TO_COMPLETE: "moving_to_complete",
  INTERACTING_COMPLETE: "interacting_complete",
  COMPLETED: "completed",
  FAILED: "failed"
};

const QUEST_TYPE_PATTERNS = {
  RESOURCES: ["Zbierz zasób"],
  MOBS: ["Pokonaj"],
  PLAYERS: ["Wygrane walki PvP"],
  LPVM: ["Wykonane Listy Gończe PvM"],
  EXPEDITION: ["Udaj się na wyprawy"],
  // INSTANCES: ["Wykonane dowolne instancje"],
  // DONATIONS: ["Oddaj przedmiot"]
};

// Define the DAILY_QUESTS object
const DAILY_QUESTS = {
  // Properties
  locations: [],
  settings: {
    active: false,
    skipDisabled: true,
    useSSJ: true,
    useCodes: false,
    useMultifight: true,
    maxFailedAttempts: 3,
    waitBetweenQuests: 2000,
    maxInteractionAttempts: 10, // Maximum number of interaction attempts before giving up
    interactionInterval: 1000   // Time between interaction attempts in ms
  },
  runtime: {
    currentLocationIndex: 0,
    currentState: QUEST_FLOW_STATES.IDLE,
    questType: null,
    questCount: 0,
    questProgress: 0,
    failedAttempts: 0,
    interactionAttempts: 0,
    isProcessing: false,
    isTeleporting: false,
    isMoving: false,
    isInteracting: false,
    lastActionTime: 0,
    timeoutId: null,
    intervalId: null,
    matrix: [],
    currentPath: [],
    lastQuestState: null // To track quest state changes
  },
  
  // Initialization
  initialize: function(locations) {
    this.locations = locations.map(loc => ({
      ...loc,
      disabled: false,
      completed: false
    }));
    this.log("Daily Quests Manager initialized with " + this.locations.length + " locations");
    
    // Set up event handlers for location toggles
    $(document).on('change', '.dq_location_toggle', function() {
      const locationIndex = $(this).closest('.dq_location').data('index');
      DAILY_QUESTS.locations[locationIndex].disabled = !this.checked;
      window.updateQuestsList();
      window.updateProgressCounter();
    });
    
    // Initialize UI
    window.updateDailyQuestsUI();
  },
  
  // Main execution loop
  mainLoop: function() {
    // If not active, do nothing
    if (!this.settings.active) return;
    
    // Clear any existing timeouts
    this.clearTimeouts();
    
    // Check if all quests are completed
    if (this.checkAllQuestsCompleted()) {
      this.log("All quests completed!");
      this.stop();
      return;
    }
    
    // Get current location
    const currentLocation = this.getCurrentLocation();
    if (!currentLocation) {
      this.log("No more locations to process");
      this.stop();
      return;
    }
    
    // Process the current state
    this.processCurrentState(currentLocation);
  },
  
  // Process the current state for the given location
  processCurrentState: function(location) {
    this.log(`Processing state: ${this.runtime.currentState} for location: ${location.name}`);
    
    switch (this.runtime.currentState) {
      case QUEST_FLOW_STATES.IDLE:
        this.runtime.currentState = QUEST_FLOW_STATES.TELEPORTING;
        this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
        break;
        
      case QUEST_FLOW_STATES.TELEPORTING:
        this.teleportToLocation(location.id);
        break;
        
      case QUEST_FLOW_STATES.MOVING_TO_START:
        this.navigateToCoordinates(location.coords);
        break;
        
      case QUEST_FLOW_STATES.INTERACTING_START:
        this.interactWithNPC("start");
        break;
        
      case QUEST_FLOW_STATES.DETECTING_QUEST:
        this.detectQuestType();
        break;
        
      case QUEST_FLOW_STATES.EXECUTING_QUEST:
        this.executeQuest();
        break;
        
      case QUEST_FLOW_STATES.MOVING_TO_COMPLETE:
        this.navigateToCoordinates(location.coords);
        break;
        
      case QUEST_FLOW_STATES.INTERACTING_COMPLETE:
        this.interactWithNPC("complete");
        break;
        
      case QUEST_FLOW_STATES.COMPLETED:
        this.completeQuest(location);
        break;
        
      case QUEST_FLOW_STATES.FAILED:
        this.handleFailedQuest(location);
        break;
        
      default:
        this.log(`Unknown state: ${this.runtime.currentState}`);
        this.runtime.currentState = QUEST_FLOW_STATES.IDLE;
        this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Teleport to a location
  teleportToLocation: function(locationId) {
    if (this.runtime.isTeleporting) return;
    
    this.runtime.isTeleporting = true;
    this.log(`Teleporting to location ID: ${locationId}`);
    
    // Check if already at the location
    if (String(GAME.char_data.loc) === String(locationId)) {
      this.log("Already at the target location");
      this.runtime.isTeleporting = false;
      this.runtime.currentState = QUEST_FLOW_STATES.MOVING_TO_START;
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Emit teleport command
    GAME.socket.emit('ga', { a: 12, type: 18, loc: locationId });
    
    // Check teleport completion
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkTeleportComplete = () => {
      if (!this.settings.active) {
        this.runtime.isTeleporting = false;
        return;
      }
      
      attempts++;
      const teleported = String(GAME.char_data.loc) === String(locationId);
      
      if (teleported) {
        this.log("Teleport successful");
        this.runtime.isTeleporting = false;
        this.runtime.currentState = QUEST_FLOW_STATES.MOVING_TO_START;
        this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 1000);
      } else if (attempts < maxAttempts) {
        this.runtime.timeoutId = setTimeout(checkTeleportComplete, 500);
      } else {
        this.log("Teleport failed after multiple attempts");
        this.runtime.isTeleporting = false;
        this.runtime.currentState = QUEST_FLOW_STATES.FAILED;
        this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
      }
    };
    
    this.runtime.timeoutId = setTimeout(checkTeleportComplete, 1000);
  },
  
  // Navigate to coordinates using pathfinding
  navigateToCoordinates: function(coords) {
    if (this.runtime.isMoving) return;
    
    this.runtime.isMoving = true;
    this.log(`Navigating to coordinates: ${coords.x}, ${coords.y}`);
    
    // Check if already at coordinates
    if (GAME.char_data.x === coords.x && GAME.char_data.y === coords.y) {
      this.log("Already at target coordinates");
      this.runtime.isMoving = false;
      
      // Update state based on current state
      if (this.runtime.currentState === QUEST_FLOW_STATES.MOVING_TO_START) {
        this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_START;
      } else if (this.runtime.currentState === QUEST_FLOW_STATES.MOVING_TO_COMPLETE) {
        this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_COMPLETE;
      }
      
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Use matrix pathfinding
    if (!this.createMatrix()) {
      this.log("Failed to create navigation matrix, using direct movement");
      this.useDirectMovement(coords);
      return;
    }
    
    // Find path to target
    if (!this.findPath(coords.x, coords.y)) {
      this.log("No path found to target coordinates, using direct movement");
      this.useDirectMovement(coords);
      return;
    }
    
    // Start moving along the path
    this.moveAlongPath();
  },
  
  // Create matrix from game map data for pathfinding
  createMatrix: function() {
    try {
      this.runtime.matrix = [];
      const mapData = GAME.mapcell;
      
      if (!mapData) {
        this.log("Map data not available");
        return false;
      }
      
      // Get map dimensions
      const maxY = parseInt(GAME.map.max_y) || 50;
      const maxX = parseInt(GAME.map.max_x) || 50;
      
      // Debug map dimensions
      this.log(`Map dimensions: ${maxX}x${maxY}`);
      
      // Initialize matrix with all walkable cells
      for (let y = 0; y < maxY; y++) {
        this.runtime.matrix[y] = [];
        for (let x = 0; x < maxX; x++) {
          this.runtime.matrix[y][x] = 0; // Default to walkable
        }
      }
      
      // Mark blockers/walls
      for (const key in mapData) {
        if (mapData.hasOwnProperty(key)) {
          const cell = mapData[key];
          if (cell && cell.m === 1) {
            // This is a blocker/wall
            // Parse coordinates from key (format: "x_y")
            const [x, y] = key.split('_').map(coord => parseInt(coord) - 1); // Convert to 0-based
            
            // Ensure coordinates are valid
            if (x >= 0 && x < maxX && y >= 0 && y < maxY) {
              this.runtime.matrix[y][x] = 1; // Mark as blocker
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      this.log(`Error creating matrix: ${error.message}`);
      return false;
    }
  },
  
  // Find path to target using matrix pathfinding
  findPath: function(targetX, targetY) {
    try {
      // Convert to 0-based coordinates for the matrix
      const startX = GAME.char_data.x - 1;
      const startY = GAME.char_data.y - 1;
      const endX = targetX - 1;
      const endY = targetY - 1;
      
      // Debug coordinates
      this.log(`Finding path from (${startX},${startY}) to (${endX},${endY})`);
      
      // Check if coordinates are valid
      if (startX < 0 || startY < 0 || endX < 0 || endY < 0 ||
          startX >= this.runtime.matrix[0].length || startY >= this.runtime.matrix.length ||
          endX >= this.runtime.matrix[0].length || endY >= this.runtime.matrix.length) {
        this.log("Invalid coordinates for pathfinding");
        return false;
      }
      
      // Check if target is a blocker
      if (this.runtime.matrix[endY][endX] === 1) {
        this.log("Target is a blocker, cannot find path");
        return false;
      }
      
      // Use pathfinding to find a path
      this.runtime.currentPath = [];
      
      // Simple BFS pathfinding implementation
      const queue = [[startX, startY]];
      const visited = {};
      const parent = {};
      visited[`${startX}_${startY}`] = true;
      
      while (queue.length > 0) {
        const [x, y] = queue.shift();
        
        // Check if we've reached the target
        if (x === endX && y === endY) {
          // Reconstruct the path
          let current = `${endX}_${endY}`;
          while (current !== `${startX}_${startY}`) {
            const [cx, cy] = current.split('_').map(Number);
            this.runtime.currentPath.unshift([cx, cy]);
            current = parent[current];
          }
          
          this.log(`Path found with ${this.runtime.currentPath.length} steps`);
          return true;
        }
        
        // Check all 8 directions
        const directions = [
          [0, -1], [1, -1], [1, 0], [1, 1], 
          [0, 1], [-1, 1], [-1, 0], [-1, -1]
        ];
        
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          
          // Check if the new position is valid
          if (nx >= 0 && nx < this.runtime.matrix[0].length && 
              ny >= 0 && ny < this.runtime.matrix.length && 
              this.runtime.matrix[ny][nx] === 0 && 
              !visited[`${nx}_${ny}`]) {
            
            queue.push([nx, ny]);
            visited[`${nx}_${ny}`] = true;
            parent[`${nx}_${ny}`] = `${x}_${y}`;
          }
        }
      }
      
      // No path found
      this.log("No path found using BFS");
      return false;
    } catch (error) {
      this.log(`Error finding path: ${error.message}`);
      return false;
    }
  },
  
  // Move along the calculated path
  moveAlongPath: function() {
    if (!this.settings.active || !this.runtime.currentPath || this.runtime.currentPath.length === 0) {
      this.runtime.isMoving = false;
      
      // Update state based on current state
      if (this.runtime.currentState === QUEST_FLOW_STATES.MOVING_TO_START) {
        this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_START;
      } else if (this.runtime.currentState === QUEST_FLOW_STATES.MOVING_TO_COMPLETE) {
        this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_COMPLETE;
      }
      
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Get the next step in the path
    const nextStep = this.runtime.currentPath[0];
    const nextX = nextStep[0] + 1; // Convert back to 1-based coordinates
    const nextY = nextStep[1] + 1;
    
    // Determine direction to move
    let direction = 0;
    const currentX = GAME.char_data.x;
    const currentY = GAME.char_data.y;
    
    if (nextX > currentX && nextY === currentY) {
      direction = 7; // Right
    } else if (nextX < currentX && nextY === currentY) {
      direction = 8; // Left
    } else if (nextX === currentX && nextY > currentY) {
      direction = 1; // Down
    } else if (nextX === currentX && nextY < currentY) {
      direction = 2; // Up
    } else if (nextX > currentX && nextY > currentY) {
      direction = 3; // Down-right
    } else if (nextX < currentX && nextY < currentY) {
      direction = 6; // Up-left
    } else if (nextX > currentX && nextY < currentY) {
      direction = 5; // Up-right
    } else if (nextX < currentX && nextY > currentY) {
      direction = 4; // Down-left
    }
    
    if (direction !== 0) {
      // Send movement command
      GAME.socket.emit('ga', {
        a: 4,
        dir: direction,
        vo: (GAME.map_options ? GAME.map_options.vo : undefined)
      });
      
      // Set up a check for movement completion
      this.runtime.intervalId = setInterval(() => {
        if (!this.settings.active) {
          clearInterval(this.runtime.intervalId);
          this.runtime.intervalId = null;
          this.runtime.isMoving = false;
          return;
        }
        
        // Check if we've reached the next position
        if (GAME.char_data.x === nextX && GAME.char_data.y === nextY) {
          clearInterval(this.runtime.intervalId);
          this.runtime.intervalId = null;
          
          // Remove the step we just completed
          this.runtime.currentPath.shift();
          
          // Continue to the next step
          this.runtime.timeoutId = setTimeout(() => {
            this.moveAlongPath();
          }, 100);
        }
      }, 200);
    } else {
      // If we can't determine a direction, try direct movement
      this.log("Could not determine direction, using direct movement");
      this.useDirectMovement({
        x: this.runtime.currentPath[this.runtime.currentPath.length - 1][0] + 1,
        y: this.runtime.currentPath[this.runtime.currentPath.length - 1][1] + 1
      });
    }
  },
  
  // Use direct movement as fallback
  useDirectMovement: function(coords) {
    this.log(`Using direct movement to coordinates: ${coords.x}, ${coords.y}`);
    
    // Calculate direction to target
    const dx = coords.x - GAME.char_data.x;
    const dy = coords.y - GAME.char_data.y;
    
    // Determine primary direction
    let direction = 0;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Move horizontally first
      if (dx > 0) {
        direction = 7; // Right
      } else {
        direction = 8; // Left
      }
    } else {
      // Move vertically first
      if (dy > 0) {
        direction = 1; // Down
      } else {
        direction = 2; // Up
      }
    }
    
    // Send movement command
    GAME.socket.emit('ga', {
      a: 4,
      dir: direction,
      vo: (GAME.map_options ? GAME.map_options.vo : undefined)
    });
    
    // Check if we've reached the target
    this.runtime.intervalId = setInterval(() => {
      if (!this.settings.active) {
        clearInterval(this.runtime.intervalId);
        this.runtime.intervalId = null;
        this.runtime.isMoving = false;
        return;
      }
      
      // Check if we've reached the target
      if (GAME.char_data.x === coords.x && GAME.char_data.y === coords.y) {
        clearInterval(this.runtime.intervalId);
        this.runtime.intervalId = null;
        this.runtime.isMoving = false;
        
        // Update state based on current state
        if (this.runtime.currentState === QUEST_FLOW_STATES.MOVING_TO_START) {
          this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_START;
        } else if (this.runtime.currentState === QUEST_FLOW_STATES.MOVING_TO_COMPLETE) {
          this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_COMPLETE;
        }
        
        this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
        return;
      }
      
      // Continue moving
      const newDx = coords.x - GAME.char_data.x;
      const newDy = coords.y - GAME.char_data.y;
      
      // Determine new direction
      let newDirection = 0;
      
      if (Math.abs(newDx) > Math.abs(newDy)) {
        // Move horizontally
        if (newDx > 0) {
          newDirection = 7; // Right
        } else if (newDx < 0) {
          newDirection = 8; // Left
        }
      } else {
        // Move vertically
        if (newDy > 0) {
          newDirection = 1; // Down
        } else if (newDy < 0) {
          newDirection = 2; // Up
        }
      }
      
      if (newDirection !== 0) {
        GAME.socket.emit('ga', {
          a: 4,
          dir: newDirection,
          vo: (GAME.map_options ? GAME.map_options.vo : undefined)
        });
      }
    }, 300);
  },
  
  // Interact with NPC using questProceed() function
  interactWithNPC: function(interactionType) {
    if (this.runtime.isInteracting) return;
    
    this.runtime.isInteracting = true;
    this.log(`Interacting with NPC (${interactionType})`);
    
    // Reset interaction attempts counter
    this.runtime.interactionAttempts = 0;
    
    // Store current quest state to detect changes
    this.captureQuestState();
    
    // Start interaction loop
    this.interactionLoop(interactionType);
  },
  
  // Capture current quest state for comparison
  captureQuestState: function() {
    // Store quest window state
    const questWindow = document.querySelector('#quest_con');
    if (questWindow) {
      // Get quest requirements text if available
      const requirementsDiv = questWindow.querySelector('.quest_desc div');
      const requirementsText = requirementsDiv ? requirementsDiv.textContent : '';
      
      // Get quest warunek data if available
      const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
      const count = questWarunek ? questWarunek.getAttribute('data-count') : null;
      const max = questWarunek ? questWarunek.getAttribute('data-max') : null;
      
      // Get finish button state
      const hasFinishButton = document.querySelector('button[data-option="finish_quest"]') !== null;
      
      // Store state
      this.runtime.lastQuestState = {
        questWindowVisible: true,
        requirementsText: requirementsText,
        count: count,
        max: max,
        hasFinishButton: hasFinishButton
      };
    } else {
      this.runtime.lastQuestState = {
        questWindowVisible: false
      };
    }
  },
  
  // Check if quest state has changed
  hasQuestStateChanged: function() {
    if (!this.runtime.lastQuestState) return true;
    
    const questWindow = document.querySelector('#quest_con');
    
    // Check if quest window visibility changed
    const questWindowVisible = questWindow !== null;
    if (questWindowVisible !== this.runtime.lastQuestState.questWindowVisible) {
      return true;
    }
    
    // If quest window is visible, check for content changes
    if (questWindowVisible) {
      // Check for finish button appearance/disappearance
      const hasFinishButton = document.querySelector('button[data-option="finish_quest"]') !== null;
      if (hasFinishButton !== this.runtime.lastQuestState.hasFinishButton) {
        return true;
      }
      
      // Check for quest warunek changes
      const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
      const count = questWarunek ? questWarunek.getAttribute('data-count') : null;
      const max = questWarunek ? questWarunek.getAttribute('data-max') : null;
      
      if (count !== this.runtime.lastQuestState.count || max !== this.runtime.lastQuestState.max) {
        return true;
      }
      
      // Check for requirements text changes
      const requirementsDiv = questWindow.querySelector('.quest_desc div');
      const requirementsText = requirementsDiv ? requirementsDiv.textContent : '';
      
      if (requirementsText !== this.runtime.lastQuestState.requirementsText) {
        return true;
      }
    }
    
    return false;
  },
  
  // Loop interaction until quest state changes or max attempts reached
  interactionLoop: function(interactionType) {
    // Check if we should stop
    if (!this.settings.active || this.runtime.interactionAttempts >= this.settings.maxInteractionAttempts) {
      this.log(`Interaction ${interactionType} ${this.runtime.interactionAttempts >= this.settings.maxInteractionAttempts ? 'reached max attempts' : 'stopped'}`);
      this.runtime.isInteracting = false;
      
      // If we've reached max attempts, consider it a failure
      if (this.runtime.interactionAttempts >= this.settings.maxInteractionAttempts) {
        this.runtime.currentState = QUEST_FLOW_STATES.FAILED;
      } else {
        // Otherwise, move to the next state based on interaction type
        if (interactionType === "start") {
          this.runtime.currentState = QUEST_FLOW_STATES.DETECTING_QUEST;
        } else if (interactionType === "complete") {
          this.runtime.currentState = QUEST_FLOW_STATES.COMPLETED;
        }
      }
      
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Increment attempts counter
    this.runtime.interactionAttempts++;
    
    // Call questProceed() function from script1-2.js
    if (typeof window.kwsv3 !== 'undefined' && typeof window.kwsv3.questProceed === 'function') {
      this.log(`Using kwsv3.questProceed() (attempt ${this.runtime.interactionAttempts})`);
      window.kwsv3.questProceed();
    } else {
      this.log(`Using fallback interaction method (attempt ${this.runtime.interactionAttempts})`);
      // Fallback to direct GAME interaction if questProceed is not available
      if (typeof GAME.parseInput === "function") {
        GAME.parseInput("x");
      }
    }
    
    // Wait for interaction to complete and check for state changes
    this.runtime.timeoutId = setTimeout(() => {
      // Check if quest state has changed
      if (this.hasQuestStateChanged()) {
        this.log(`Quest state changed after interaction ${interactionType}`);
        this.runtime.isInteracting = false;
        
        // Update state based on interaction type
        if (interactionType === "start") {
          this.runtime.currentState = QUEST_FLOW_STATES.DETECTING_QUEST;
        } else if (interactionType === "complete") {
          this.runtime.currentState = QUEST_FLOW_STATES.COMPLETED;
        }
        
        this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
      } else {
        // No change yet, continue interaction loop
        this.log(`No quest state change yet, continuing interaction ${interactionType}`);
        this.interactionLoop(interactionType);
      }
    }, this.settings.interactionInterval);
  },
  
  // Detect quest type from dialog text or quest window
  detectQuestType: function() {
    this.log("Detecting quest type");
    
    // Check if quest window is open
    const questWindow = document.querySelector('#quest_con');
    if (questWindow) {
      // Get quest requirements text
      const requirementsDiv = questWindow.querySelector('.quest_desc div');
      if (requirementsDiv) {
        const requirementsText = requirementsDiv.textContent.toLowerCase();
        
        // Check if quest is already completed
        const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
        if (questWarunek) {
          const count = parseInt(questWarunek.getAttribute('data-count') || '0');
          const max = parseInt(questWarunek.getAttribute('data-max') || '0');
          
          if (count >= max) {
            this.log("Quest already completed, moving to completion phase");
            this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_COMPLETE;
            this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
            return;
          }
          
          // Set quest count
          this.runtime.questCount = max;
        }
        
        // Detect quest type from requirements text
        let questType = null;
        
        // Check for resources quest
        if (requirementsText.includes("zbierz zasób")) {
          questType = "resources";
        }
        // Check for mobs quest
        else if (requirementsText.includes("pokonaj:")) {
          questType = "mobs";
          
          // Check mob type and difficulty
          const mobTypeMatch = requirementsText.match(/\(([^)]+)\)/);
          if (mobTypeMatch) {
            const mobType = mobTypeMatch[1].toLowerCase();
            
            // Set RESP ignore settings based on mob difficulty
            if (mobType.includes("normal")) {
              this.log("Setting RESP to target Normal mobs");
              window.kws_spawner_ignore_0 = 0;
              window.kws_spawner_ignore_1 = 1;
              window.kws_spawner_ignore_2 = 1;
              window.kws_spawner_ignore_3 = 1;
              window.kws_spawner_ignore_4 = 1;
            } else if (mobType.includes("champion")) {
              this.log("Setting RESP to target Champion mobs");
              window.kws_spawner_ignore_0 = 1;
              window.kws_spawner_ignore_1 = 0;
              window.kws_spawner_ignore_2 = 1;
              window.kws_spawner_ignore_3 = 1;
              window.kws_spawner_ignore_4 = 1;
            } else if (mobType.includes("elita")) {
              this.log("Setting RESP to target Elite mobs");
              window.kws_spawner_ignore_0 = 1;
              window.kws_spawner_ignore_1 = 1;
              window.kws_spawner_ignore_2 = 0;
              window.kws_spawner_ignore_3 = 1;
              window.kws_spawner_ignore_4 = 1;
            } else if (mobType.includes("legendarny")) {
              this.log("Setting RESP to target Legendary mobs");
              window.kws_spawner_ignore_0 = 1;
              window.kws_spawner_ignore_1 = 1;
              window.kws_spawner_ignore_2 = 1;
              window.kws_spawner_ignore_3 = 0;
              window.kws_spawner_ignore_4 = 1;
            } else if (mobType.includes("epicki")) {
              this.log("Setting RESP to target Epic mobs");
              window.kws_spawner_ignore_0 = 1;
              window.kws_spawner_ignore_1 = 1;
              window.kws_spawner_ignore_2 = 1;
              window.kws_spawner_ignore_3 = 1;
              window.kws_spawner_ignore_4 = 0;
            }
          }
        }
        // Check for players quest
        else if (requirementsText.includes("wygrane walki pvp")) {
          questType = "players";
        }
        // Check for LPVM quest
        else if (requirementsText.includes("wykonane listy gończe pvm")) {
          questType = "lpvm";
        }
        // Check for expedition quest
        else if (requirementsText.includes("udaj się na wyprawy")) {
          questType = "expedition";
        }
        
        if (questType) {
          this.log(`Detected quest type: ${questType}, count: ${this.runtime.questCount}`);
          this.runtime.questType = questType;
          this.runtime.questProgress = 0;
          this.runtime.currentState = QUEST_FLOW_STATES.EXECUTING_QUEST;
          this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
        } else {
          this.log("Could not detect quest type, assuming it's a simple interaction quest");
          // For simple quests that just require talking, we can move directly to completion
          this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_COMPLETE;
          this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
        }
      } else {
        this.log("No requirements found, assuming it's a simple interaction quest");
        this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_COMPLETE;
        this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
      }
    } else {
      this.log("No quest window found, retrying interaction");
      this.runtime.currentState = QUEST_FLOW_STATES.INTERACTING_START;
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Execute the detected quest
  executeQuest: function() {
    this.log(`Executing quest type: ${this.runtime.questType}`);
    
    switch (this.runtime.questType) {
      case "resources":
        this.executeResourcesQuest();
        break;
      case "mobs":
        this.executeMobsQuest();
        break;
      case "players":
        this.executePlayersQuest();
        break;
      case "lpvm":
        this.executeLPVMQuest();
        break;
      case "expedition":
        this.executeExpeditionQuest();
        break;
      default:
        this.log("Unknown quest type, moving to completion");
        this.runtime.currentState = QUEST_FLOW_STATES.MOVING_TO_COMPLETE;
        this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Execute a resources collection quest
  executeResourcesQuest: function() {
    this.log(`Starting resource collection: ${this.runtime.questCount} resources needed`);
    
    // Check if RES is already active and defined
    if (typeof window.RES !== 'undefined' && window.RES && !window.RES.stop) {
      window.RES.stop = true;
      $(".res_res .res_status").removeClass("green").addClass("red").html("Off");
    }
    
    // Start RES if it exists
    if (typeof window.RES !== 'undefined' && window.RES) {
      window.RES.stop = false;
      window.RES.action();
      $(".res_res .res_status").removeClass("red").addClass("green").html("On");
      
      // Monitor collection progress
      let checkInterval = 2000;
      
      const checkCollectionProgress = () => {
        if (!this.settings.active) {
          if (typeof window.RES !== 'undefined' && window.RES && !window.RES.stop) {
            window.RES.stop = true;
            $(".res_res .res_status").removeClass("green").addClass("red").html("Off");
          }
          return;
        }
        
        // Check if quest window is still open
        const questWindow = document.querySelector('#quest_con');
        if (questWindow) {
          const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
          if (questWarunek) {
            const count = parseInt(questWarunek.getAttribute('data-count') || '0');
            const max = parseInt(questWarunek.getAttribute('data-max') || '0');
            
            this.runtime.questProgress = count;
            this.log(`Resource collection progress: ${count}/${max}`);
            
            if (count >= max) {
              // Stop RES
              if (typeof window.RES !== 'undefined' && window.RES) {
                window.RES.stop = true;
                $(".res_res .res_status").removeClass("green").addClass("red").html("Off");
              }
              
              // Move to completion
              this.runtime.currentState = QUEST_FLOW_STATES.MOVING_TO_COMPLETE;
              this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
              return;
            }
          }
        }
        
        // Continue checking
        this.runtime.timeoutId = setTimeout(checkCollectionProgress, checkInterval);
      };
      
      this.runtime.timeoutId = setTimeout(checkCollectionProgress, checkInterval);
    } else {
      this.log("RES feature not available, skipping quest");
      this.runtime.currentState = QUEST_FLOW_STATES.FAILED;
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Execute a kill mobs quest
  executeMobsQuest: function() {
    this.log(`Starting to kill mobs: ${this.runtime.questCount} mobs needed`);
    GAME.socket.emit('ga', { a: 15, type: 13});
    
    // Check if RESP is already active and defined
    if (typeof window.RESP !== 'undefined' && window.RESP && !window.RESP.stop) {
      window.RESP.stop = true;
      $(".resp_resp .resp_status").removeClass("green").addClass("red").html("Off");
    }
    
    // Configure RESP settings if it exists
    if (typeof window.RESP !== 'undefined' && window.RESP) {
      window.RESP.stop = true;
      window.RESP.code = false;
      window.RESP.checkSSJ = this.settings.useSSJ;
      window.RESP.multifight = this.settings.useMultifight;
      
      // Start RESP
      window.RESP.stop = false;
      window.RESP.action();
      $(".resp_resp .resp_status").removeClass("red").addClass("green").html("On");
      
      // Monitor kill progress
      let checkInterval = 10000;
      
      const checkKillProgress = () => {
        if (!this.settings.active) {
          if (typeof window.RESP !== 'undefined' && window.RESP && !window.RESP.stop) {
            window.RESP.stop = true;
            GAME.socket.emit('ga', { a: 16 });
            $(".resp_resp .resp_status").removeClass("green").addClass("red").html("Off");
          }
          return;
        }
        
        // Check if quest window is still open
        const questWindow = document.querySelector('#quest_con');
        if (questWindow) {
          const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
          if (questWarunek) {
            const count = parseInt(questWarunek.getAttribute('data-count') || '0');
            const max = parseInt(questWarunek.getAttribute('data-max') || '0');
            
            this.runtime.questProgress = count;
            this.log(`Kills progress: ${count}/${max}`);
            
            if (count >= max) {
              // Stop RESP
              if (typeof window.RESP !== 'undefined' && window.RESP) {
                window.RESP.stop = true;
                $(".resp_resp .resp_status").removeClass("green").addClass("red").html("Off");
              }
              
              // Move to completion
              this.runtime.currentState = QUEST_FLOW_STATES.MOVING_TO_COMPLETE;
              this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
              return;
            }
          }
        }
        
        // Continue checking
        this.runtime.timeoutId = setTimeout(checkKillProgress, checkInterval);
      };
      
      this.runtime.timeoutId = setTimeout(checkKillProgress, checkInterval);
    } else {
      this.log("RESP feature not available, skipping quest");
      this.runtime.currentState = QUEST_FLOW_STATES.FAILED;
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Execute a kill players quest
  executePlayersQuest: function() {
    this.log(`Starting to kill players: ${this.runtime.questCount} players needed`);
    
    // Check if PVP is already active and defined
    if (typeof window.PVP !== 'undefined' && window.PVP && !window.PVP.stop) {
      window.PVP.stop = true;
      $(".pvp_pvp .pvp_status").removeClass("green").addClass("red").html("Off");
    }
    
    // Configure PVP settings if it exists
    if (typeof window.PVP !== 'undefined' && window.PVP) {
      window.PVP.stop = true;
      window.PVP.code = false;
      
      // Start PVP
      window.PVP.stop = false;
      window.PVP.start();
      $(".pvp_pvp .pvp_status").removeClass("red").addClass("green").html("On");
      
      // Monitor kill progress
      let checkInterval = 2000;
      
      const checkKillProgress = () => {
        if (!this.settings.active) {
          if (typeof window.PVP !== 'undefined' && window.PVP && !window.PVP.stop) {
            window.PVP.stop = true;
            $(".pvp_pvp .pvp_status").removeClass("green").addClass("red").html("Off");
          }
          return;
        }
        
        // Check if quest window is still open
        const questWindow = document.querySelector('#quest_con');
        if (questWindow) {
          const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
          if (questWarunek) {
            const count = parseInt(questWarunek.getAttribute('data-count') || '0');
            const max = parseInt(questWarunek.getAttribute('data-max') || '0');
            
            this.runtime.questProgress = count;
            this.log(`PVP kills progress: ${count}/${max}`);
            
            if (count >= max) {
              // Stop PVP
              if (typeof window.PVP !== 'undefined' && window.PVP) {
                window.PVP.stop = true;
                $(".pvp_pvp .pvp_status").removeClass("green").addClass("red").html("Off");
              }
              
              // Move to completion
              this.runtime.currentState = QUEST_FLOW_STATES.MOVING_TO_COMPLETE;
              this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
              return;
            }
          }
        }
        
        // Continue checking
        this.runtime.timeoutId = setTimeout(checkKillProgress, checkInterval);
      };
      
      this.runtime.timeoutId = setTimeout(checkKillProgress, checkInterval);
    } else {
      this.log("PVP feature not available, skipping quest");
      this.runtime.currentState = QUEST_FLOW_STATES.FAILED;
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Execute an LPVM quest
  executeLPVMQuest: function() {
    this.log(`Starting LPVM task: ${this.runtime.questCount} quests needed`);
    
    // Check if LPVM is already active and defined
    if (typeof window.LPVM !== 'undefined' && window.LPVM && !window.LPVM.Stop) {
      window.LPVM.Stop = true;
      $(".lpvm_lpvm .lpvm_status").removeClass("green").addClass("red").html("Off");
    }
    
    // Configure LPVM settings based on reborn level if it exists
    if (typeof window.LPVM !== 'undefined' && window.LPVM) {
      window.LPVM.Stop = true;
      const reborn = GAME.char_data.reborn;
      
      // Reset all LPVM settings
      window.LPVM.g = false;
      window.LPVM.u = false;
      window.LPVM.s = true;
      window.LPVM.h = false;
      window.LPVM.m = false;
      
      // Set appropriate reborn level
      // if (reborn === 0) {
      //   $(".lpvm_g .lpvm_status").removeClass("red").addClass("green").html("On");
      //   window.LPVM.g = true;
      // } else if (reborn === 1) {
      //   $(".lpvm_u .lpvm_status").removeClass("red").addClass("green").html("On");
      //   window.LPVM.u = true;
      // } else if (reborn === 2) {
      //   $(".lpvm_s .lpvm_status").removeClass("red").addClass("green").html("On");
      //   window.LPVM.s = true;
      // } else if (reborn === 3) {
      //   $(".lpvm_h .lpvm_status").removeClass("red").addClass("green").html("On");
      //   window.LPVM.h = true;
      // } else if (reborn >= 4) {
      //   $(".lpvm_m .lpvm_status").removeClass("red").addClass("green").html("On");
      //   window.LPVM.m = true;
      // }
      
      // Start LPVM
      window.LPVM.Stop = false;
      window.LPVM.action();
      $(".lpvm_lpvm .lpvm_status").removeClass("red").addClass("green").html("On");
      
      // Monitor LPVM progress
      let initialCompleted = parseInt($('.pvm_killed b').text()) || 0;
      let checkInterval = 5000;
      
      const checkLPVMProgress = () => {
        if (!this.settings.active) {
          if (typeof window.LPVM !== 'undefined' && window.LPVM && !window.LPVM.Stop) {
            window.LPVM.Stop = true;
            $(".lpvm_lpvm .lpvm_status").removeClass("green").addClass("red").html("Off");
          }
          return;
        }
        
        // Check if quest window is still open
        const questWindow = document.querySelector('#quest_con');
        if (questWindow) {
          const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
          if (questWarunek) {
            const count = parseInt(questWarunek.getAttribute('data-count') || '0');
            const max = parseInt(questWarunek.getAttribute('data-max') || '0');
            
            this.runtime.questProgress = count;
            this.log(`LPVM progress: ${count}/${max}`);
            
            if (count >= max) {
              // Stop LPVM
              if (typeof window.LPVM !== 'undefined' && window.LPVM) {
                window.LPVM.Stop = true;
                $(".lpvm_lpvm .lpvm_status").removeClass("green").addClass("red").html("Off");
              }
              
              // Move to completion
              this.runtime.currentState = QUEST_FLOW_STATES.MOVING_TO_COMPLETE;
              this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
              return;
            }
          }
        }
        
        // Continue checking
        this.runtime.timeoutId = setTimeout(checkLPVMProgress, checkInterval);
      };
      
      this.runtime.timeoutId = setTimeout(checkLPVMProgress, checkInterval);
    } else {
      this.log("LPVM feature not available, skipping quest");
      this.runtime.currentState = QUEST_FLOW_STATES.FAILED;
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Execute an expedition quest
  executeExpeditionQuest: function() {
    this.log(`Starting expedition task: ${this.runtime.questCount} expeditions needed`);
    
    // We'll use the autoExpeditions feature from kwsv3 if available
    if (window.kwsv3 && typeof kwsv3.manageAutoExpeditions === "function") {
      // First check if it's already active
      if (kwsv3.autoExpeditions) {
        kwsv3.manageAutoExpeditions(); // Turn it off
      }
      
      // Configure expedition settings
      // kwsv3.settings.aeCodes = this.settings.useCodes;
      
      // Start expeditions
      kwsv3.manageAutoExpeditions();
      
      // Monitor expedition progress
      let checkInterval = 301000; // Expeditions take longer
      
      const checkExpeditionProgress = () => {
        if (!this.settings.active) {
          if (window.kwsv3 && kwsv3.autoExpeditions) {
            kwsv3.manageAutoExpeditions(); // Turn it off
          }
          return;
        }
        
        // Check if quest window is still open
        const questWindow = document.querySelector('#quest_con');
        if (questWindow) {
          const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
          if (questWarunek) {
            const count = parseInt(questWarunek.getAttribute('data-count') || '0');
            const max = parseInt(questWarunek.getAttribute('data-max') || '0');
            
            this.runtime.questProgress = count;
            this.log(`Expedition progress: ${count}/${max}`);
            
            if (count >= max) {
              // Stop expeditions
              if (window.kwsv3 && kwsv3.autoExpeditions) {
                kwsv3.manageAutoExpeditions();
              }
              
              // Move to completion
              this.runtime.currentState = QUEST_FLOW_STATES.MOVING_TO_COMPLETE;
              this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
              return;
            }
          }
        }
        
        // Continue checking
        this.runtime.timeoutId = setTimeout(checkExpeditionProgress, checkInterval);
      };
      
      this.runtime.timeoutId = setTimeout(checkExpeditionProgress, checkInterval);
    } else {
      this.log("Expedition feature not available, skipping quest");
      this.runtime.currentState = QUEST_FLOW_STATES.FAILED;
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Complete the current quest
  completeQuest: function(location) {
    this.log(`Completing quest: ${location.name}`);
    
    // Mark the location as completed
    location.completed = true;
    
    // Move to the next location
    this.runtime.currentLocationIndex++;
    this.runtime.currentState = QUEST_FLOW_STATES.IDLE;
    this.runtime.questType = null;
    this.runtime.questCount = 0;
    this.runtime.questProgress = 0;
    this.runtime.failedAttempts = 0;
    
    // Update UI
    this.updateUI();
    
    // Continue to next quest
    this.runtime.timeoutId = setTimeout(() => this.mainLoop(), this.settings.waitBetweenQuests);
  },
  
  // Handle a failed quest
  handleFailedQuest: function(location) {
    this.log(`Quest failed: ${location.name}`);
    this.runtime.failedAttempts++;
    
    if (this.runtime.failedAttempts >= this.settings.maxFailedAttempts) {
      this.log(`Maximum failed attempts (${this.settings.maxFailedAttempts}) reached, skipping quest`);
      
      // Mark the location as completed (skipped)
      location.completed = true;
      
      // Move to the next location
      this.runtime.currentLocationIndex++;
      this.runtime.currentState = QUEST_FLOW_STATES.IDLE;
      this.runtime.questType = null;
      this.runtime.questCount = 0;
      this.runtime.questProgress = 0;
      this.runtime.failedAttempts = 0;
      
      // Update UI
      this.updateUI();
      
      // Continue to next quest
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), this.settings.waitBetweenQuests);
    } else {
      this.log(`Retrying quest (attempt ${this.runtime.failedAttempts}/${this.settings.maxFailedAttempts})`);
      this.runtime.currentState = QUEST_FLOW_STATES.IDLE;
      this.runtime.timeoutId = setTimeout(() => this.mainLoop(), 2000);
    }
  },
  
  // Get the current location being processed
  getCurrentLocation: function() {
    // Check if current index is valid
    if (this.runtime.currentLocationIndex >= this.locations.length) {
      return null;
    }
    
    const location = this.locations[this.runtime.currentLocationIndex];
    
    // Skip disabled or completed locations
    if ((location.disabled && this.settings.skipDisabled) || location.completed) {
      this.runtime.currentLocationIndex++;
      return this.getCurrentLocation();
    }
    
    return location;
  },
  
  // Check if all quests are completed
  checkAllQuestsCompleted: function() {
    return this.locations.every(loc => loc.completed || (loc.disabled && this.settings.skipDisabled));
  },
  
  // Reset progress for all quests
  resetAllProgress: function() {
    this.locations.forEach(location => {
      location.completed = false;
    });
    
    this.runtime.currentLocationIndex = 0;
    this.runtime.currentState = QUEST_FLOW_STATES.IDLE;
    this.runtime.questType = null;
    this.runtime.questCount = 0;
    this.runtime.questProgress = 0;
    this.runtime.failedAttempts = 0;
    
    this.updateUI();
  },
  
  // Start the daily quests automation
  start: function() {
    if (this.settings.active) return;
    
    this.settings.active = true;
    this.log("Starting daily quests automation");
    
    // Initialize state
    this.runtime.currentState = QUEST_FLOW_STATES.IDLE;
    
    // Start the main loop
    this.mainLoop();
  },
  
  // Stop the daily quests automation
  stop: function() {
    if (!this.settings.active) return;
    
    this.settings.active = false;
    this.log("Stopping daily quests automation");
    
    // Clear any timeouts or intervals
    this.clearTimeouts();
    
    // Stop any active features - with existence checks
    if (typeof window.RESP !== 'undefined' && window.RESP && !window.RESP.stop) {
      window.RESP.stop = true;
      $(".resp_resp .resp_status").removeClass("green").addClass("red").html("Off");
    }
    
    if (typeof window.PVP !== 'undefined' && window.PVP && !window.PVP.stop) {
      window.PVP.stop = true;
      $(".pvp_pvp .pvp_status").removeClass("green").addClass("red").html("Off");
    }
    
    if (typeof window.LPVM !== 'undefined' && window.LPVM && !window.LPVM.Stop) {
      window.LPVM.Stop = true;
      $(".lpvm_lpvm .lpvm_status").removeClass("green").addClass("red").html("Off");
    }
    
    if (typeof window.RES !== 'undefined' && window.RES && !window.RES.stop) {
      window.RES.stop = true;
      $(".res_res .res_status").removeClass("green").addClass("red").html("Off");
    }
  },
  
  // Clear all timeouts and intervals
  clearTimeouts: function() {
    if (this.runtime.timeoutId) {
      clearTimeout(this.runtime.timeoutId);
      this.runtime.timeoutId = null;
    }
    
    if (this.runtime.intervalId) {
      clearInterval(this.runtime.intervalId);
      this.runtime.intervalId = null;
    }
  },
  
  // Update the UI with current state
  updateUI: function() {
    if (typeof window.updateDailyQuestsUI === "function") {
      window.updateDailyQuestsUI();
    }
    
    // Update status message based on current state
    if (typeof window.setStatusMessage === "function") {
      const location = this.getCurrentLocation();
      const locationName = location ? location.name : "Unknown";
      
      let statusMessage = "";
      switch (this.runtime.currentState) {
        case QUEST_FLOW_STATES.IDLE:
          statusMessage = "Ready to start";
          break;
        case QUEST_FLOW_STATES.TELEPORTING:
          statusMessage = `Teleporting to ${locationName}`;
          break;
        case QUEST_FLOW_STATES.MOVING_TO_START:
          statusMessage = `Moving to quest giver in ${locationName}`;
          break;
        case QUEST_FLOW_STATES.INTERACTING_START:
          statusMessage = `Starting quest in ${locationName}`;
          break;
        case QUEST_FLOW_STATES.DETECTING_QUEST:
          statusMessage = `Detecting quest type in ${locationName}`;
          break;
        case QUEST_FLOW_STATES.EXECUTING_QUEST:
          statusMessage = `Executing ${this.runtime.questType} quest: ${this.runtime.questProgress}/${this.runtime.questCount}`;
          break;
        case QUEST_FLOW_STATES.MOVING_TO_COMPLETE:
          statusMessage = `Returning to quest giver in ${locationName}`;
          break;
        case QUEST_FLOW_STATES.INTERACTING_COMPLETE:
          statusMessage = `Completing quest in ${locationName}`;
          break;
        default:
          statusMessage = `Processing ${locationName}`;
      }
      
      window.setStatusMessage(statusMessage);
    }
  },
  
  // Log a message
  log: function(message) {
    console.log(`[DAILY QUESTS] ${message}`);
    
    // Update UI status message
    if (typeof window.setStatusMessage === "function") {
      window.setStatusMessage(message);
    }
    
    // Also use GAME.komunikat if available
    if (typeof GAME !== "undefined" && typeof GAME.komunikat === "function") {
      GAME.komunikat(`[DAILY QUESTS] ${message}`);
    }
  }
};

// Initialize event handlers for Daily Quests panel
$(document).ready(function() {
  // Add click handler for main Daily Quests button
  $('#main_Panel .gh_daily_quests').click(function() {
    if ($(".gh_daily_quests .gh_status").hasClass("red")) {
      $(".gh_daily_quests .gh_status").removeClass("red").addClass("green").html("On");
      $("#daily_quests_Panel").show();
    } else {
      $(".gh_daily_quests .gh_status").removeClass("green").addClass("red").html("Off");
      $("#daily_quests_Panel").hide();
      if (window.DAILY_QUESTS) {
        window.DAILY_QUESTS.stop();
      }
      $(".dq_start_stop .dq_status").removeClass("green").addClass("red").html("Off");
    }
  });

  // Add click handlers for panel buttons
  $('#daily_quests_Panel .dq_start_stop').click(function() {
    if ($(".dq_start_stop .dq_status").hasClass("red")) {
      $(".dq_start_stop .dq_status").removeClass("red").addClass("green").html("On");
      if (window.DAILY_QUESTS) {
        window.DAILY_QUESTS.start();
      }
    } else {
      $(".dq_start_stop .dq_status").removeClass("green").addClass("red").html("Off");
      if (window.DAILY_QUESTS) {
        window.DAILY_QUESTS.stop();
      }
    }
  });

  $('#daily_quests_Panel .dq_reset').click(function() {
    if (confirm("Are you sure you want to reset all quest progress?")) {
      if (window.DAILY_QUESTS) {
        window.DAILY_QUESTS.resetAllProgress();
      }
    }
  });
  
  // Initialize DAILY_QUESTS with locations if available
  if (typeof window.DAILY_QUESTS_LOCATIONS !== 'undefined' && window.DAILY_QUESTS_LOCATIONS.length > 0) {
    window.DAILY_QUESTS = DAILY_QUESTS;
    window.DAILY_QUESTS.initialize(window.DAILY_QUESTS_LOCATIONS);
  } else {
    console.error("[DAILY QUESTS] Locations not found. Make sure daily_quests_locations.js is loaded before daily_quests_manager.js");
  }
});

// Make DAILY_QUESTS available globally
window.DAILY_QUESTS = DAILY_QUESTS;
