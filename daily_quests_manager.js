/**
 * Daily Quests Manager - Final Version
 * 
 * This file contains the core logic for the Daily Quests Manager feature.
 * It handles quest detection, execution, and state management.
 * 
 * FIXES:
 * - Reintroduced matrix pathfinding to avoid blockers
 * - Embedded direct questProceed logic instead of calling it
 * - Fixed checkbox and disabled locations bug
 * - Simplified state management
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
    if (window.DAILY_QUESTS.currentLocationIndex === index && window.DAILY_QUESTS.active) {
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

// Define the DAILY_QUESTS object with minimal properties
const DAILY_QUESTS = {
  // Properties
  locations: [],
  active: false,
  currentLocationIndex: 0,
  currentState: "idle",
  timeoutId: null,
  intervalId: null,
  isTeleporting: false,
  isMoving: false,
  isInteracting: false,
  matrix: [],
  currentPath: [],
  
  // Quest type patterns as provided by user
  QUEST_TYPE_PATTERNS: {
    RESOURCES: ["Zbierz zasób"],
    MOBS: ["Pokonaj"],
    PLAYERS: ["Wygrane walki PvP"],
    LPVM: ["Wykonane Listy Gończe PvM"],
    EXPEDITION: ["Udaj się na wyprawy"],
    INSTANCES: ["Wykonane dowolne instancje"],
    DONATIONS: ["Oddaj przedmiot", "Oddaj PSK"]
  },
  
  // Initialization
  initialize: function(locations) {
    // Make a deep copy of locations to avoid reference issues
    this.locations = JSON.parse(JSON.stringify(locations));
    
    // Initialize disabled and completed flags
    this.locations.forEach(loc => {
      loc.disabled = false;
      loc.completed = false;
    });
    
    this.log("Daily Quests Manager initialized with " + this.locations.length + " locations");
    
    // Initialize UI
    window.updateDailyQuestsUI();
    
    // Set up event handlers for location toggles
    $(document).off('change', '.dq_location_toggle').on('change', '.dq_location_toggle', function() {
      const locationIndex = $(this).closest('.dq_location').data('index');
      if (window.DAILY_QUESTS && window.DAILY_QUESTS.locations && window.DAILY_QUESTS.locations[locationIndex]) {
        window.DAILY_QUESTS.locations[locationIndex].disabled = !this.checked;
        window.updateQuestsList();
        window.updateProgressCounter();
      }
    });
  },
  
  // Main execution loop
  mainLoop: function() {
    // If not active, do nothing
    if (!this.active) return;
    
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
    this.log(`Processing state: ${this.currentState} for location: ${location.name}`);
    
    switch (this.currentState) {
      case "idle":
        this.currentState = "teleporting";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
        break;
        
      case "teleporting":
        this.teleportToLocation(location.id);
        break;
        
      case "moving":
        this.navigateToCoordinates(location.coords);
        break;
        
      case "interacting":
        this.interactWithNPC(location);
        break;
        
      case "executing":
        this.executeQuest(location);
        break;
        
      case "completed":
        this.completeQuest(location);
        break;
        
      case "failed":
        this.handleFailedQuest(location);
        break;
        
      default:
        this.log(`Unknown state: ${this.currentState}`);
        this.currentState = "idle";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Teleport to a location
  teleportToLocation: function(locationId) {
    if (this.isTeleporting) return;
    
    this.isTeleporting = true;
    this.log(`Teleporting to location ID: ${locationId}`);
    
    // Check if already at the location
    if (String(GAME.char_data.loc) === String(locationId)) {
      this.log("Already at the target location");
      this.isTeleporting = false;
      this.currentState = "moving";
      this.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Emit teleport command
    GAME.socket.emit('ga', { a: 12, type: 18, loc: locationId });
    
    // Check teleport completion
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkTeleportComplete = () => {
      if (!this.active) {
        this.isTeleporting = false;
        return;
      }
      
      attempts++;
      const teleported = String(GAME.char_data.loc) === String(locationId);
      
      if (teleported) {
        this.log("Teleport successful");
        this.isTeleporting = false;
        this.currentState = "moving";
        this.timeoutId = setTimeout(() => this.mainLoop(), 1000);
      } else if (attempts < maxAttempts) {
        this.timeoutId = setTimeout(checkTeleportComplete, 500);
      } else {
        this.log("Teleport failed after multiple attempts");
        this.isTeleporting = false;
        this.currentState = "failed";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
      }
    };
    
    this.timeoutId = setTimeout(checkTeleportComplete, 1000);
  },
  
  // Navigate to coordinates using pathfinding
  navigateToCoordinates: function(coords) {
    if (this.isMoving) return;
    
    this.isMoving = true;
    this.log(`Navigating to coordinates: ${coords.x}, ${coords.y}`);
    
    // Check if already at coordinates
    if (GAME.char_data.x === coords.x && GAME.char_data.y === coords.y) {
      this.log("Already at target coordinates");
      this.isMoving = false;
      this.currentState = "interacting";
      this.timeoutId = setTimeout(() => this.mainLoop(), 500);
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
      this.matrix = [];
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
        this.matrix[y] = [];
        for (let x = 0; x < maxX; x++) {
          this.matrix[y][x] = 0; // Default to walkable
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
              this.matrix[y][x] = 1; // Mark as blocker
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
          startX >= this.matrix[0].length || startY >= this.matrix.length ||
          endX >= this.matrix[0].length || endY >= this.matrix.length) {
        this.log("Invalid coordinates for pathfinding");
        return false;
      }
      
      // Check if target is a blocker
      if (this.matrix[endY][endX] === 1) {
        this.log("Target is a blocker, cannot find path");
        return false;
      }
      
      // Use pathfinding to find a path
      this.currentPath = [];
      
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
            this.currentPath.unshift([cx, cy]);
            current = parent[current];
          }
          
          this.log(`Path found with ${this.currentPath.length} steps`);
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
          if (nx >= 0 && nx < this.matrix[0].length && 
              ny >= 0 && ny < this.matrix.length && 
              this.matrix[ny][nx] === 0 && 
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
    if (!this.active || !this.currentPath || this.currentPath.length === 0) {
      this.isMoving = false;
      this.currentState = "interacting";
      this.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Get the next step in the path
    const nextStep = this.currentPath[0];
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
      this.intervalId = setInterval(() => {
        if (!this.active) {
          clearInterval(this.intervalId);
          this.intervalId = null;
          this.isMoving = false;
          return;
        }
        
        // Check if we've reached the next position
        if (GAME.char_data.x === nextX && GAME.char_data.y === nextY) {
          clearInterval(this.intervalId);
          this.intervalId = null;
          
          // Remove the step we just completed
          this.currentPath.shift();
          
          // Continue to the next step
          this.timeoutId = setTimeout(() => {
            this.moveAlongPath();
          }, 100);
        }
      }, 200);
    } else {
      // If we can't determine a direction, try direct movement
      this.log("Could not determine direction, using direct movement");
      this.useDirectMovement({
        x: this.currentPath[this.currentPath.length - 1][0] + 1,
        y: this.currentPath[this.currentPath.length - 1][1] + 1
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
    this.intervalId = setInterval(() => {
      if (!this.active) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isMoving = false;
        return;
      }
      
      // Check if we've reached the target
      if (GAME.char_data.x === coords.x && GAME.char_data.y === coords.y) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isMoving = false;
        this.currentState = "interacting";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
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
  
  // Direct implementation of questProceed function
  directQuestProceed: function() {
    if (JQS.qcc.is(":visible")) {
      if ($("button[data-option=finish_quest]").length === 1) {
        let qb_id = $("button[data-option=finish_quest]").attr("data-qb_id");
        GAME.socket.emit('ga', {
          a: 22,
          type: 2,
          button: 1,
          id: qb_id
        });
      } else if ($("button[data-option=quest_riddle]").is(":visible")) {
        let qb_id = $("button[data-option=quest_riddle]").attr("data-qid");
        GAME.socket.emit('ga', {
          a: 22,
          type: 7,
          id: qb_id,
          ans: $('#quest_riddle').val()
        });
      } else if ($("button[data-option=quest_duel]").is(":visible")) {
        let fb_id = $("button[data-option=quest_duel]").attr("data-qid");
        GAME.socket.emit('ga', {
          a: 22,
          type: 6,
          id: fb_id
        });
      } else if ($(".quest_win .sekcja").text().toLowerCase() === "nuda" && $("button[data-option=finish_quest]").length === 3) {
        let qb_id = $("button[data-option=finish_quest]").attr("data-qb_id");
        GAME.socket.emit('ga', {
          a: 22,
          type: 2,
          button: 2,
          id: qb_id
        });
      } else if ($(".quest_win .sekcja").text().toLowerCase().startsWith("zadanie substancji") && $("button[data-option=finish_quest]").length === 3) {
        let qb_id = $("button[data-option=finish_quest]").attr("data-qb_id");
        GAME.socket.emit('ga', {
          a: 22,
          type: 2,
          button: 3,
          id: qb_id
        });
      } else if ($("button[data-option=finish_quest]").length === 2 && $("button[data-option=finish_quest]").eq(1).html() === "Mam dość tej studni") {
        let qb_id = $("button[data-option=finish_quest]").eq(1).attr("data-qb_id");
        GAME.socket.emit('ga', {
          a: 22,
          type: 2,
          button: 2,
          id: qb_id
        });
      } else if ($("#field_opts_con .sekcja").html() == "Zasoby") {
        let qb_id = $("#field_opts_con .field_option").find("[data-option=start_mine]").attr("data-mid");
        GAME.socket.emit('ga', {
          a: 22,
          type: 8,
          mid: qb_id
        });
      } else if ($(".quest_action").is(":visible")) {
        GAME.questAction();
      }
      setTimeout(() => {
        $('#fight_view').fadeOut();
      }, 500);
      kom_clear();
    } else if ($("button[data-option=start_mine]").length >= 1) {
      let mineID = parseInt($("button[data-option=start_mine]").attr("data-mid"));
      GAME.socket.emit('ga', {
        a: 22,
        type: 8,
        mid: mineID
      });
    } else if ($("#field_opts_con").is(":visible")) {
      let quest = $("#field_opts_con .field_quest").first();
      if (quest.length) {
        let qb_id = quest.attr("data-qb");
        GAME.socket.emit('ga', {
          a: 22,
          type: 1,
          id: qb_id
        });
      }
    }
  },
  
  // Interact with NPC using direct questProceed implementation
  interactWithNPC: function(location) {
    if (this.isInteracting) return;
    
    this.isInteracting = true;
    this.log(`Interacting with NPC at ${location.name}`);
    
    // Start interaction loop
    this.interactionLoop(location);
  },
  
  // Simple interaction loop that calls directQuestProceed repeatedly
  interactionLoop: function(location) {
    // Maximum number of interaction attempts
    const maxAttempts = 20;
    let attempts = 0;
    let interactionInterval = null;
    
    // Function to check quest state
    const checkQuestState = () => {
      attempts++;
      
      // Stop if no longer active
      if (!this.active) {
        clearInterval(interactionInterval);
        this.isInteracting = false;
        return;
      }
      
      // Check if quest window is open
      const questWindow = document.querySelector('#quest_con');
      const fieldOptsWindow = document.querySelector('#field_opts_con');
      
      // Call directQuestProceed to interact
      this.directQuestProceed();
      
      // Check if we have a quest with requirements
      if (questWindow) {
        const requirementsDiv = questWindow.querySelector('.quest_desc div');
        if (requirementsDiv) {
          const requirementsText = requirementsDiv.textContent;
          
          // Check if this is a quest we need to execute
          let questType = this.detectQuestType(requirementsText);
          
          if (questType) {
            // We have a quest to execute
            clearInterval(interactionInterval);
            this.isInteracting = false;
            this.currentQuestType = questType;
            this.currentState = "executing";
            this.timeoutId = setTimeout(() => this.mainLoop(), 500);
            return;
          }
          
          // Check if quest is already completed
          const questWarunek = questWindow.querySelector('[class^="quest_warunek"]');
          if (questWarunek) {
            const count = parseInt(questWarunek.getAttribute('data-count') || '0');
            const max = parseInt(questWarunek.getAttribute('data-max') || '0');
            
            if (count >= max) {
              // Quest is completed, continue interacting to finish it
              this.log("Quest requirements met, continuing interaction to complete");
            }
          }
          
          // Check for finish button
          const finishButton = questWindow.querySelector('button[data-option="finish_quest"]');
          if (finishButton) {
            this.log("Found finish button, clicking it");
            // Let directQuestProceed handle the button click
          }
        }
      }
      
      // Check if quest is completed (quest window closed after completion)
      if (!questWindow && !fieldOptsWindow && attempts > 3) {
        clearInterval(interactionInterval);
        this.isInteracting = false;
        this.currentState = "completed";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
        return;
      }
      
      // Check if we've reached max attempts
      if (attempts >= maxAttempts) {
        clearInterval(interactionInterval);
        this.isInteracting = false;
        this.currentState = "failed";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
        return;
      }
    };
    
    // Start the interaction loop
    interactionInterval = setInterval(checkQuestState, 1000);
  },
  
  // Detect quest type from requirements text
  detectQuestType: function(text) {
    if (!text) return null;
    
    text = text.toLowerCase();
    
    // Check each quest type pattern
    for (const [type, patterns] of Object.entries(this.QUEST_TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (text.includes(pattern.toLowerCase())) {
          return type;
        }
      }
    }
    
    return null;
  },
  
  // Execute the detected quest
  executeQuest: function(location) {
    this.log(`Executing quest type: ${this.currentQuestType}`);
    
    switch (this.currentQuestType) {
      case "RESOURCES":
        this.executeResourcesQuest(location);
        break;
      case "MOBS":
        this.executeMobsQuest(location);
        break;
      case "PLAYERS":
        this.executePlayersQuest(location);
        break;
      case "LPVM":
        this.executeLPVMQuest(location);
        break;
      case "EXPEDITION":
        this.executeExpeditionQuest(location);
        break;
      case "INSTANCES":
        this.executeInstancesQuest(location);
        break;
      case "DONATIONS":
        // For donations, just go back to interacting
        this.currentState = "interacting";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
        break;
      default:
        this.log("Unknown quest type, continuing interaction");
        this.currentState = "interacting";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Execute a resources collection quest
  executeResourcesQuest: function(location) {
    this.log(`Starting resource collection`);
    
    // Check if RES is defined
    if (typeof window.RES === 'undefined') {
      this.log("RES feature not available, returning to interaction");
      this.currentState = "interacting";
      this.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Start RES
    window.RES.stop = false;
    window.RES.action();
    $(".res_res .res_status").removeClass("red").addClass("green").html("On");
    
    // Monitor collection progress
    let checkInterval = 2000;
    
    const checkCollectionProgress = () => {
      if (!this.active) {
        if (typeof window.RES !== 'undefined') {
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
          
          this.log(`Resource collection progress: ${count}/${max}`);
          
          if (count >= max) {
            // Stop RES
            if (typeof window.RES !== 'undefined') {
              window.RES.stop = true;
              $(".res_res .res_status").removeClass("green").addClass("red").html("Off");
            }
            
            // Return to interaction
            this.currentState = "interacting";
            this.timeoutId = setTimeout(() => this.mainLoop(), 500);
            return;
          }
        }
      } else {
        // Quest window closed, check if we need to return to interaction
        this.currentState = "interacting";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
        return;
      }
      
      // Continue checking
      this.timeoutId = setTimeout(checkCollectionProgress, checkInterval);
    };
    
    this.timeoutId = setTimeout(checkCollectionProgress, checkInterval);
  },
  
  // Execute a kill mobs quest
  executeMobsQuest: function(location) {
    this.log(`Starting to kill mobs`);
    
    // Check if RESP is defined
    if (typeof window.RESP === 'undefined') {
      this.log("RESP feature not available, returning to interaction");
      this.currentState = "interacting";
      this.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Configure RESP settings
    window.RESP.stop = true;
    window.RESP.code = false;
    window.RESP.checkSSJ = true;
    window.RESP.multifight = true;
    
    // Start RESP
    window.RESP.stop = false;
    window.RESP.action();
    $(".resp_resp .resp_status").removeClass("red").addClass("green").html("On");
    
    // Monitor kill progress
    let checkInterval = 2000;
    
    const checkKillProgress = () => {
      if (!this.active) {
        if (typeof window.RESP !== 'undefined') {
          window.RESP.stop = true;
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
          
          this.log(`Kills progress: ${count}/${max}`);
          
          if (count >= max) {
            // Stop RESP
            if (typeof window.RESP !== 'undefined') {
              window.RESP.stop = true;
              $(".resp_resp .resp_status").removeClass("green").addClass("red").html("Off");
            }
            
            // Return to interaction
            this.currentState = "interacting";
            this.timeoutId = setTimeout(() => this.mainLoop(), 500);
            return;
          }
        }
      } else {
        // Quest window closed, check if we need to return to interaction
        this.currentState = "interacting";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
        return;
      }
      
      // Continue checking
      this.timeoutId = setTimeout(checkKillProgress, checkInterval);
    };
    
    this.timeoutId = setTimeout(checkKillProgress, checkInterval);
  },
  
  // Execute a kill players quest
  executePlayersQuest: function(location) {
    this.log(`Starting to kill players`);
    
    // Check if PVP is defined
    if (typeof window.PVP === 'undefined') {
      this.log("PVP feature not available, returning to interaction");
      this.currentState = "interacting";
      this.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Configure PVP settings
    window.PVP.stop = true;
    window.PVP.code = false;
    
    // Start PVP
    window.PVP.stop = false;
    window.PVP.start();
    $(".pvp_pvp .pvp_status").removeClass("red").addClass("green").html("On");
    
    // Monitor kill progress
    let checkInterval = 2000;
    
    const checkKillProgress = () => {
      if (!this.active) {
        if (typeof window.PVP !== 'undefined') {
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
          
          this.log(`PVP kills progress: ${count}/${max}`);
          
          if (count >= max) {
            // Stop PVP
            if (typeof window.PVP !== 'undefined') {
              window.PVP.stop = true;
              $(".pvp_pvp .pvp_status").removeClass("green").addClass("red").html("Off");
            }
            
            // Return to interaction
            this.currentState = "interacting";
            this.timeoutId = setTimeout(() => this.mainLoop(), 500);
            return;
          }
        }
      } else {
        // Quest window closed, check if we need to return to interaction
        this.currentState = "interacting";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
        return;
      }
      
      // Continue checking
      this.timeoutId = setTimeout(checkKillProgress, checkInterval);
    };
    
    this.timeoutId = setTimeout(checkKillProgress, checkInterval);
  },
  
  // Execute an LPVM quest
  executeLPVMQuest: function(location) {
    this.log(`Starting LPVM task`);
    
    // Check if LPVM is defined
    if (typeof window.LPVM === 'undefined') {
      this.log("LPVM feature not available, returning to interaction");
      this.currentState = "interacting";
      this.timeoutId = setTimeout(() => this.mainLoop(), 500);
      return;
    }
    
    // Configure LPVM settings based on reborn level
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
    let checkInterval = 5000;
    
    const checkLPVMProgress = () => {
      if (!this.active) {
        if (typeof window.LPVM !== 'undefined') {
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
          
          this.log(`LPVM progress: ${count}/${max}`);
          
          if (count >= max) {
            // Stop LPVM
            if (typeof window.LPVM !== 'undefined') {
              window.LPVM.Stop = true;
              $(".lpvm_lpvm .lpvm_status").removeClass("green").addClass("red").html("Off");
            }
            
            // Return to interaction
            this.currentState = "interacting";
            this.timeoutId = setTimeout(() => this.mainLoop(), 500);
            return;
          }
        }
      } else {
        // Quest window closed, check if we need to return to interaction
        this.currentState = "interacting";
        this.timeoutId = setTimeout(() => this.mainLoop(), 500);
        return;
      }
      
      // Continue checking
      this.timeoutId = setTimeout(checkLPVMProgress, checkInterval);
    };
    
    this.timeoutId = setTimeout(checkLPVMProgress, checkInterval);
  },
  
  // Execute an expedition quest
  executeExpeditionQuest: function(location) {
    this.log(`Starting expedition task`);
    
    // We'll use the autoExpeditions feature from kwsv3 if available
    if (window.kwsv3 && typeof kwsv3.manageAutoExpeditions === "function") {
      // First check if it's already active
      if (kwsv3.autoExpeditions) {
        kwsv3.manageAutoExpeditions(); // Turn it off
      }
      
      // Configure expedition settings
      kwsv3.settings.aeCodes = false;
      
      // Start expeditions
      kwsv3.manageAutoExpeditions();
      
      // Monitor expedition progress
      let checkInterval = 301000; // Expeditions take longer
      
      const checkExpeditionProgress = () => {
        if (!this.active) {
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
            
            this.log(`Expedition progress: ${count}/${max}`);
            
            if (count >= max) {
              // Stop expeditions
              if (window.kwsv3 && kwsv3.autoExpeditions) {
                kwsv3.manageAutoExpeditions();
              }
              
              // Return to interaction
              this.currentState = "interacting";
              this.timeoutId = setTimeout(() => this.mainLoop(), 500);
              return;
            }
          }
        } else {
          // Quest window closed, check if we need to return to interaction
          this.currentState = "interacting";
          this.timeoutId = setTimeout(() => this.mainLoop(), 500);
          return;
        }
        
        // Continue checking
        this.timeoutId = setTimeout(checkExpeditionProgress, checkInterval);
      };
      
      this.timeoutId = setTimeout(checkExpeditionProgress, checkInterval);
    } else {
      this.log("Expedition feature not available, returning to interaction");
      this.currentState = "interacting";
      this.timeoutId = setTimeout(() => this.mainLoop(), 500);
    }
  },
  
  // Execute an instances quest
  executeInstancesQuest: function(location) {
    this.log(`Instances quest detected, returning to interaction to continue manually`);
    this.currentState = "interacting";
    this.timeoutId = setTimeout(() => this.mainLoop(), 500);
  },
  
  // Complete the current quest
  completeQuest: function(location) {
    this.log(`Completing quest: ${location.name}`);
    
    // Mark the location as completed
    location.completed = true;
    
    // Move to the next location
    this.currentLocationIndex++;
    this.currentState = "idle";
    this.currentQuestType = null;
    
    // Update UI
    this.updateUI();
    
    // Continue to next quest
    this.timeoutId = setTimeout(() => this.mainLoop(), 2000);
  },
  
  // Handle a failed quest
  handleFailedQuest: function(location) {
    this.log(`Quest failed: ${location.name}, skipping to next location`);
    
    // Mark the location as completed (skipped)
    location.completed = true;
    
    // Move to the next location
    this.currentLocationIndex++;
    this.currentState = "idle";
    this.currentQuestType = null;
    
    // Update UI
    this.updateUI();
    
    // Continue to next quest
    this.timeoutId = setTimeout(() => this.mainLoop(), 2000);
  },
  
  // Get the current location being processed
  getCurrentLocation: function() {
    // Check if current index is valid
    if (this.currentLocationIndex >= this.locations.length) {
      return null;
    }
    
    const location = this.locations[this.currentLocationIndex];
    
    // Skip disabled or completed locations
    if (location.disabled || location.completed) {
      this.currentLocationIndex++;
      return this.getCurrentLocation();
    }
    
    return location;
  },
  
  // Check if all quests are completed
  checkAllQuestsCompleted: function() {
    return this.locations.every(loc => loc.completed || loc.disabled);
  },
  
  // Reset progress for all quests
  resetAllProgress: function() {
    this.locations.forEach(location => {
      location.completed = false;
    });
    
    this.currentLocationIndex = 0;
    this.currentState = "idle";
    this.currentQuestType = null;
    
    this.updateUI();
  },
  
  // Start the daily quests automation
  start: function() {
    if (this.active) return;
    
    this.active = true;
    this.log("Starting daily quests automation");
    
    // Initialize state
    this.currentState = "idle";
    
    // Start the main loop
    this.mainLoop();
  },
  
  // Stop the daily quests automation
  stop: function() {
    if (!this.active) return;
    
    this.active = false;
    this.log("Stopping daily quests automation");
    
    // Clear any timeouts or intervals
    this.clearTimeouts();
    
    // Reset all flags
    this.isTeleporting = false;
    this.isMoving = false;
    this.isInteracting = false;
    
    // Stop any active features - with existence checks
    if (typeof window.RESP !== 'undefined' && window.RESP) {
      window.RESP.stop = true;
      $(".resp_resp .resp_status").removeClass("green").addClass("red").html("Off");
    }
    
    if (typeof window.PVP !== 'undefined' && window.PVP) {
      window.PVP.stop = true;
      $(".pvp_pvp .pvp_status").removeClass("green").addClass("red").html("Off");
    }
    
    if (typeof window.LPVM !== 'undefined' && window.LPVM) {
      window.LPVM.Stop = true;
      $(".lpvm_lpvm .lpvm_status").removeClass("green").addClass("red").html("Off");
    }
    
    if (typeof window.RES !== 'undefined' && window.RES) {
      window.RES.stop = true;
      $(".res_res .res_status").removeClass("green").addClass("red").html("Off");
    }
  },
  
  // Clear all timeouts and intervals
  clearTimeouts: function() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
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
      switch (this.currentState) {
        case "idle":
          statusMessage = "Ready to start";
          break;
        case "teleporting":
          statusMessage = `Teleporting to ${locationName}`;
          break;
        case "moving":
          statusMessage = `Moving to quest giver in ${locationName}`;
          break;
        case "interacting":
          statusMessage = `Interacting with NPC in ${locationName}`;
          break;
        case "executing":
          statusMessage = `Executing ${this.currentQuestType} quest in ${locationName}`;
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
