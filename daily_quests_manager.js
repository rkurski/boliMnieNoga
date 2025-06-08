/**
 * Daily Quests Manager
 * 
 * This file adds daily quests automation to the existing AFO system.
 * It is designed to be loaded after the main AFO script.
 */

// Create the DAILY_QUESTS object if it doesn't exist
if (typeof GAME !== 'undefined') {
    // Wait for AFO to be fully loaded
    let DailyQuestsInit = setInterval(() => {
        // Check if AFO and LPVM are loaded
        if (typeof window.LPVM !== 'undefined') {
            clearInterval(DailyQuestsInit);
            
            // Create Daily Quests object
            window.DAILY_QUESTS = {
                settings: {
                    active: false,
                    skipTypes: {
                        RESOURCES: false,
                        MOBS: false,
                        PLAYERS: false,
                        LPVM: false,
                        EXPEDITION: false,
                        INSTANCES: false,
                        DONATIONS: false
                    }
                },
                runtime: {
                    currentLocationIndex: 0,
                    isProcessingQuest: false,
                    questType: null,
                    questGoals: [],
                    currentGoalIndex: 0,
                    checkInterval: null
                },
                QUEST_TYPE_PATTERNS: {
                    RESOURCES: ["Zbierz zasób"],
                    MOBS: ["Pokonaj"],
                    PLAYERS: ["Wygrane walki PvP"],
                    LPVM: ["Wykonane Listy Gończe PvM"],
                    EXPEDITION: ["Udaj się na wyprawy"],
                    INSTANCES: ["Wykonane dowolne instancje"],
                    DONATIONS: ["Oddaj przedmiot", "Oddaj PSK"]
                },
                MOB_TYPES: {
                    "Normalny": 0,
                    "Elitarny": 1,
                    "Czempion": 2,
                    "Bossek": 3
                },
                locations: [],
                
                // Initialize the daily quests system
                initialize: function() {
                    console.log("[DAILY QUESTS] Initializing");
                    this.initializeLocations();
                    this.setupUI();
                    this.setupEventHandlers();
                },
                
                // Load locations from the separate file
                initializeLocations: function() {
                    if (window.DAILY_QUESTS_LOCATIONS && Array.isArray(window.DAILY_QUESTS_LOCATIONS)) {
                        this.locations = window.DAILY_QUESTS_LOCATIONS.map(loc => ({
                            ...loc,
                            disabled: false,
                            completed: false
                        }));
                        console.log("[DAILY QUESTS] Loaded " + this.locations.length + " locations");
                    } else {
                        console.error("[DAILY QUESTS] Locations not found or not an array!");
                        this.locations = [];
                    }
                },
                
                // Set up the UI elements
                setupUI: function() {
                    // Add CSS for the daily quests panel if not already added
                    if (!$("#daily_quests_Panel").length) {
                        const cssdq = ` #daily_quests_Panel { background: rgba(0,0,0,0.9); position: fixed; top: 250px; left: 65%; z-index: 9999; width: 200px; padding: 1px; border-radius: 5px; border-style: solid; border-width: 7px 8px 7px 7px; display:block; user-select: none; color: #333333; max-height: 400px; overflow-y: auto; } #daily_quests_Panel .sekcja { position: absolute; top: -27px; left: -7px; background: rgba(0,0,0,0.9); filter: hue-rotate(196deg); background-size: 100% 100%; width: 200px; cursor: all-scroll; } #daily_quests_Panel .dq_button {cursor:pointer;text-align:center; border-bottom:solid gray 1px; color: white;} #daily_quests_Panel .dq_location {display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: solid gray 1px; color: white;} #daily_quests_Panel .dq_location_name {flex-grow: 1; text-align: left; padding-left: 5px;} #daily_quests_Panel .dq_location_toggle {cursor: pointer; width: 20px; height: 20px; margin-right: 5px;} #daily_quests_Panel .dq_location_status {width: 20px; height: 20px; margin-right: 5px;} #daily_quests_Panel .dq_progress {text-align: center; padding: 5px; color: white; font-weight: bold;} #daily_quests_Panel .dq_status {text-align: center; padding: 5px; color: #ffcc00; font-style: italic;} #daily_quests_Panel .completed {text-decoration: line-through; opacity: 0.7;} #daily_quests_Panel .active {background-color: rgba(0, 255, 0, 0.2);} `;
                        
                        const DAILY_QUESTS_HTML = ` <div id="daily_quests_Panel"> <div class="sekcja dq_dragg">DAILY QUESTS</div> <div class="dq_button dq_toggle">START<b class="dq_status red">Off</b></div> <div class="dq_button dq_reset">RESET PROGRESS</div> <div class="dq_progress">Progress: <span id="dq_progress_count">0/0</span></div> <div class="dq_status" id="dq_status_message">Ready to start</div> <div id="dq_locations_list"></div> </div> `;
                        
                        $("body").append(`<style>${cssdq}</style>${DAILY_QUESTS_HTML}`);
                        
                        $("#daily_quests_Panel").hide();
                        $("#daily_quests_Panel").draggable({
                            handle: ".dq_dragg"
                        });
                    }
                    
                    this.updateQuestsList();
                    this.updateProgressCounter();
                },
                
                // Set up event handlers
                setupEventHandlers: function() {
                    // Remove any existing handlers to prevent duplicates
                    $("body").off("click", ".dq_button.dq_toggle");
                    $("body").off("click", ".dq_button.dq_reset");
                    $("body").off("change", ".dq_location_toggle");
                    
                    // Setup event handlers for the daily quests panel
                    $("body").on("click", ".dq_button.dq_toggle", () => {
                        this.toggleActive();
                    });
                    
                    $("body").on("click", ".dq_button.dq_reset", () => {
                        this.resetProgress();
                    });
                    
                    $("body").on("change", ".dq_location_toggle", function() {
                        const index = $(this).closest(".dq_location").data("index");
                        if (typeof index === 'number' && DAILY_QUESTS && DAILY_QUESTS.locations) {
                            DAILY_QUESTS.toggleLocationEnabled(index);
                        }
                    });
                    
                    // Setup the main panel button handler
                    $("#main_Panel .gh_daily_quests").off("click");
                    $("#main_Panel .gh_daily_quests").on("click", () => {
                        if ($(".gh_daily_quests .gh_status").hasClass("red")) {
                            $(".gh_daily_quests .gh_status").removeClass("red").addClass("green").html("On");
                            $("#daily_quests_Panel").show();
                            this.updateQuestsList();
                            this.updateProgressCounter();
                        } else {
                            $(".gh_daily_quests .gh_status").removeClass("green").addClass("red").html("Off");
                            $("#daily_quests_Panel").hide();
                            if (this.settings.active) {
                                this.toggleActive();
                            }
                        }
                    });
                },
                
                // Toggle active state
                toggleActive: function() {
                    this.settings.active = !this.settings.active;
                    
                    if (this.settings.active) {
                        $(".dq_button.dq_toggle b").removeClass("red").addClass("green").html("On");
                        this.startQuestProcessing();
                    } else {
                        $(".dq_button.dq_toggle b").removeClass("green").addClass("red").html("Off");
                        this.stopQuestProcessing();
                    }
                },
                
                // Toggle location enabled/disabled
                toggleLocationEnabled: function(index) {
                    if (index >= 0 && index < this.locations.length) {
                        this.locations[index].disabled = !this.locations[index].disabled;
                        this.updateQuestsList();
                    }
                },
                
                // Reset progress
                resetProgress: function() {
                    this.locations.forEach(loc => {
                        loc.completed = false;
                    });
                    this.runtime.currentLocationIndex = 0;
                    this.updateQuestsList();
                    this.updateProgressCounter();
                    this.setStatusMessage("Progress reset");
                },
                
                // Start quest processing
                startQuestProcessing: function() {
                    this.findNextLocation();
                    
                    if (this.runtime.currentLocationIndex < this.locations.length) {
                        this.setStatusMessage("Starting quest at " + this.locations[this.runtime.currentLocationIndex].name);
                        this.updateQuestsList();
                        this.teleportToCurrentLocation();
                    } else {
                        this.setStatusMessage("All quests completed!");
                        this.settings.active = false;
                        $(".dq_button.dq_toggle b").removeClass("green").addClass("red").html("Off");
                    }
                },
                
                // Stop quest processing
                stopQuestProcessing: function() {
                    if (this.runtime.checkInterval) {
                        clearInterval(this.runtime.checkInterval);
                        this.runtime.checkInterval = null;
                    }
                    
                    this.runtime.isProcessingQuest = false;
                    this.stopActivities();
                    this.setStatusMessage("Quest processing stopped");
                    this.updateQuestsList();
                },
                
                // Find next location
                findNextLocation: function() {
                    for (let i = this.runtime.currentLocationIndex; i < this.locations.length; i++) {
                        if (!this.locations[i].completed && !this.locations[i].disabled) {
                            this.runtime.currentLocationIndex = i;
                            return;
                        }
                    }
                    this.runtime.currentLocationIndex = this.locations.length;
                },
                
                // Teleport to current location
                teleportToCurrentLocation: function() {
                    if (this.runtime.currentLocationIndex >= this.locations.length) {
                        this.completeAllQuests();
                        return;
                    }
                    
                    const location = this.locations[this.runtime.currentLocationIndex];
                    this.setStatusMessage("Teleporting to " + location.name);
                    
                    // Use the existing teleport logic
                    GAME.socket.emit('ga', {
                        a: 12,
                        type: 18,
                        loc: parseInt(location.id)
                    });
                    
                    // Wait for teleport to complete
                    setTimeout(() => {
                        if (!this.settings.active) return;
                        this.moveToQuestGiver();
                    }, 3000);
                },
                
                // Move to quest giver using LPVM pathfinding
                moveToQuestGiver: function() {
                    if (!this.settings.active) return;
                    
                    const location = this.locations[this.runtime.currentLocationIndex];
                    this.setStatusMessage("Moving to quest giver in " + location.name);
                    
                    // Use existing LPVM pathfinding
                    if (typeof window.LPVM === 'undefined' || !window.LPVM.go_to_xy) {
                        console.error("[DAILY QUESTS] LPVM pathfinding not available");
                        this.setStatusMessage("Error: Pathfinding not available");
                        this.skipCurrentLocation();
                        return;
                    }
                    
                    // Use LPVM's go_to_xy function to handle pathfinding and movement
                    window.LPVM.go_to_xy(location.coords.x, location.coords.y, () => {
                        if (!this.settings.active) return;
                        this.interactWithQuestGiver();
                    });
                },
                
                // Interact with quest giver
                interactWithQuestGiver: function() {
                    if (!this.settings.active) return;
                    this.setStatusMessage("Interacting with quest giver");
                    
                    // Interact with NPC
                    GAME.socket.emit('ga', { a: 2 });
                    
                    // Wait for quest window to appear
                    setTimeout(() => {
                        if (!this.settings.active) return;
                        this.processCurrentQuest();
                    }, 1000);
                },
                
                // Process current quest
                processCurrentQuest: function() {
                    if (!this.settings.active) return;
                    
                    this.runtime.isProcessingQuest = true;
                    this.setStatusMessage("Processing quest");
                    
                    if ($("#quest_con").length === 0) {
                        this.setStatusMessage("Quest window not found. Retrying interaction...");
                        setTimeout(() => {
                            if (!this.settings.active) return;
                            this.markCurrentLocationComplete();
                            this.moveToNextLocation();
                        }, 2000);
                        return;
                    }
                    
                    this.analyzeQuestContent();
                    
                    if (this.runtime.questType) {
                        this.processQuestByType();
                    } else {
                        this.setStatusMessage("Unknown quest type, using default action.");
                        this.useQuestProceed();
                    }
                },
                
                // Analyze quest content
                analyzeQuestContent: function() {
                    const $questDesc = $("#quest_con .quest_desc");
                    if ($questDesc.length === 0) {
                        this.runtime.questType = null;
                        this.runtime.questGoals = [];
                        return;
                    }
                    
                    const questContentHTML = $questDesc.html();
                    this.runtime.questType = null;
                    this.runtime.questGoals = [];
                    this.runtime.currentGoalIndex = 0;
                    
                    for (const [type, patterns] of Object.entries(this.QUEST_TYPE_PATTERNS)) {
                        for (const pattern of patterns) {
                            if (questContentHTML.includes(pattern)) {
                                this.runtime.questType = type;
                                
                                if (type === "RESOURCES") this.extractResourceGoals(questContentHTML);
                                else if (type === "MOBS") this.extractMobGoals(questContentHTML);
                                else if (type === "PLAYERS") this.extractPlayerGoals(questContentHTML);
                                else if (type === "LPVM") this.extractLPVMGoals(questContentHTML);
                                else if (type === "EXPEDITION") this.extractExpeditionGoals(questContentHTML);
                                else if (type === "INSTANCES") this.extractInstanceGoals(questContentHTML);
                                else if (type === "DONATIONS") this.runtime.questGoals = [{ type: "donation", current: 0, required: 1 }];
                                
                                break;
                            }
                        }
                        if (this.runtime.questType) break;
                    }
                },
                
                // Extract resource goals
                extractResourceGoals: function(content) {
                    const regex = /Zbierz zasób\s+<strong[^>]*>([^<]+)<\/strong>\s*<span[^>]*data-count="(\d+)"[^>]*data-max="(\d+)"[^>]*>\d+\/\d+<\/span>/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        this.runtime.questGoals.push({
                            type: "resource",
                            name: match[1].trim(),
                            current: parseInt(match[2]),
                            required: parseInt(match[3])
                        });
                    }
                },
                
                // Extract mob goals
                extractMobGoals: function(content) {
                    const regex = /Pokonaj\s+<strong[^>]*>([^<]+)<\/strong>\s*<span[^>]*data-count="(\d+)"[^>]*data-max="(\d+)"[^>]*>\d+\/\d+<\/span>/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        const mobDesc = match[1].trim();
                        const mobType = this.determineMobType(mobDesc);
                        this.runtime.questGoals.push({
                            type: "mob",
                            description: mobDesc,
                            mobType: mobType,
                            current: parseInt(match[2]),
                            required: parseInt(match[3])
                        });
                    }
                },
                
                // Determine mob type
                determineMobType: function(description) {
                    if (description.includes("Elitarny")) return 1;
                    if (description.includes("Czempion")) return 2;
                    if (description.includes("Bossek")) return 3;
                    return 0; // Default to Normalny
                },
                
                // Extract player goals
                extractPlayerGoals: function(content) {
                    const regex = /Wygrane walki PvP\s*<span[^>]*data-count="(\d+)"[^>]*data-max="(\d+)"[^>]*>\d+\/\d+<\/span>/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        this.runtime.questGoals.push({
                            type: "pvp",
                            current: parseInt(match[1]),
                            required: parseInt(match[2])
                        });
                    }
                },
                
                // Extract LPVM goals
                extractLPVMGoals: function(content) {
                    const regex = /Wykonane Listy Gończe PvM\s*<span[^>]*data-count="(\d+)"[^>]*data-max="(\d+)"[^>]*>\d+\/\d+<\/span>/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        this.runtime.questGoals.push({
                            type: "lpvm",
                            current: parseInt(match[1]),
                            required: parseInt(match[2])
                        });
                    }
                },
                
                // Extract expedition goals
                extractExpeditionGoals: function(content) {
                    const regex = /Udaj się na wyprawy\s*<span[^>]*data-count="(\d+)"[^>]*data-max="(\d+)"[^>]*>\d+\/\d+<\/span>/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        this.runtime.questGoals.push({
                            type: "expedition",
                            current: parseInt(match[1]),
                            required: parseInt(match[2])
                        });
                    }
                },
                
                // Extract instance goals
                extractInstanceGoals: function(content) {
                    const regex = /Wykonane dowolne instancje\s*<span[^>]*data-count="(\d+)"[^>]*data-max="(\d+)"[^>]*>\d+\/\d+<\/span>/g;
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        this.runtime.questGoals.push({
                            type: "instance",
                            current: parseInt(match[1]),
                            required: parseInt(match[2])
                        });
                    }
                },
                
                // Process quest by type
                processQuestByType: function() {
                    if (!this.settings.active) return;
                    if (this.runtime.questGoals.length === 0 || this.runtime.currentGoalIndex >= this.runtime.questGoals.length) {
                        this.finishQuest();
                        return;
                    }
                    
                    const currentGoal = this.runtime.questGoals[this.runtime.currentGoalIndex];
                    const questType = currentGoal.type.toUpperCase();
                    
                    if (this.settings.skipTypes[questType]) {
                        this.setStatusMessage("Skipping " + questType + " quest");
                        this.skipCurrentQuest();
                        return;
                    }
                    
                    this.setStatusMessage("Processing " + questType + " quest goal");
                    
                    switch (questType) {
                        case "RESOURCE": this.processResourceQuest(); break;
                        case "MOB": this.processMobQuest(); break;
                        case "PVP": this.processPlayerQuest(); break;
                        case "LPVM": this.processLPVMQuest(); break;
                        case "EXPEDITION": this.processExpeditionQuest(); break;
                        case "INSTANCE": this.processInstanceQuest(); break;
                        case "DONATION": this.processDonationQuest(); break;
                        default: this.useQuestProceed(); break;
                    }
                },
                
                // Process resource quest
                processResourceQuest: function() {
                    this.setStatusMessage("Collecting resources");
                    this.startProgressChecking();
                    
                    // Use existing RES feature
                    if ($("#res_Panel .res_status").hasClass("red")) {
                        $("#res_Panel .res_button.res_res").click();
                    }
                    
                    // Also try to click the resource on the map if available
                    if ($(".map_res_cont").length > 0) {
                        GAME.socket.emit('ga', { a: 3 });
                    }
                },
                
                // Process mob quest
                processMobQuest: function() {
                    this.setStatusMessage("Hunting mobs");
                    this.startProgressChecking();
                    
                    const currentGoal = this.runtime.questGoals[this.runtime.currentGoalIndex];
                    this.configureMobSpawner(currentGoal.mobType);
                    
                    // Use existing RESP feature
                    if ($("#resp_Panel .resp_status").hasClass("red")) {
                        $("#resp_Panel .resp_button.resp_resp").click();
                    }
                    
                    // Trigger multi-fight
                    GAME.socket.emit('ga', { a: 15, type: 13 });
                },
                
                // Configure mob spawner
                configureMobSpawner: function(mobType) {
                    if (typeof RESP === 'undefined') {
                        console.error("[DAILY QUESTS] RESP object not available");
                        return;
                    }
                    
                    const buttons = [
                        $("#resp_Panel .resp_blue"), 
                        $("#resp_Panel .resp_green"), 
                        $("#resp_Panel .resp_purple"), 
                        $("#resp_Panel .resp_yellow"), 
                        $("#resp_Panel .resp_red")
                    ];
                    
                    for(let i=0; i < buttons.length; i++) {
                        const shouldBeActive = (i === mobType);
                        const currentStatus = buttons[i].find('.resp_status').hasClass('green');
                        if (shouldBeActive && !currentStatus) {
                            buttons[i].click();
                        } else if (!shouldBeActive && currentStatus) {
                            buttons[i].click();
                        }
                    }
                    
                    // Ensure main RESP is active
                    if ($("#resp_Panel .resp_resp .resp_status").hasClass("red")) {
                        $("#resp_Panel .resp_resp").click();
                    }
                },
                
                // Process player quest
                processPlayerQuest: function() {
                    this.setStatusMessage("Starting PVP");
                    this.startProgressChecking();
                    
                    // Use existing PVP feature
                    if ($("#pvp_Panel .pvp_status").hasClass("red")) {
                        $("#pvp_Panel .pvp_button.pvp_pvp").click();
                    }
                },
                
                // Process LPVM quest
                processLPVMQuest: function() {
                    this.setStatusMessage("Starting LPVM");
                    this.startProgressChecking();
                    
                    // Use existing LPVM feature
                    if ($("#lpvm_Panel .lpvm_status").hasClass("red")) {
                        $("#lpvm_Panel .lpvm_button.lpvm_lpvm").click();
                    }
                },
                
                // Process expedition quest
                processExpeditionQuest: function() {
                    this.setStatusMessage("Processing expedition quest");
                    this.useQuestProceed();
                },
                
                // Process instance quest
                processInstanceQuest: function() {
                    this.setStatusMessage("Processing instance quest");
                    this.useQuestProceed();
                },
                
                // Process donation quest
                processDonationQuest: function() {
                    this.setStatusMessage("Processing donation quest");
                    this.useQuestProceed();
                },
                
                // Use quest proceed
                useQuestProceed: function() {
                    this.setStatusMessage("Using default quest action");
                    
                    // Use existing questProceed method
                    if (typeof kwsk === 'object' && typeof kwsk.questProceed === 'function') {
                        kwsk.questProceed();
                    } else {
                        // Fallback: try clicking the first available option in the quest window
                        const $questOption = $("#quest_con .option:not(.closeicon)").first();
                        if ($questOption.length > 0) {
                            $questOption.click();
                        } else {
                            this.setStatusMessage("No default action found!");
                            this.skipCurrentQuest();
                            return;
                        }
                    }
                    
                    // Check completion after a delay
                    setTimeout(() => {
                        if (!this.settings.active) return;
                        this.checkQuestCompletion();
                    }, 2000);
                },
                
                // Start progress checking
                startProgressChecking: function() {
                    if (this.runtime.checkInterval) {
                        clearInterval(this.runtime.checkInterval);
                    }
                    
                    this.runtime.checkInterval = setInterval(() => {
                        if (!this.settings.active) {
                            clearInterval(this.runtime.checkInterval);
                            this.runtime.checkInterval = null;
                            return;
                        }
                        this.checkQuestProgress();
                    }, 10000); // Check every 10 seconds
                },
                
                // Check quest progress
                checkQuestProgress: function() {
                    if (!this.settings.active || !this.runtime.isProcessingQuest || $("#quest_con").length === 0) {
                        if (this.runtime.checkInterval) {
                            clearInterval(this.runtime.checkInterval);
                            this.runtime.checkInterval = null;
                        }
                        return;
                    }
                    
                    const oldGoals = JSON.stringify(this.runtime.questGoals);
                    this.analyzeQuestContent();
                    const newGoals = JSON.stringify(this.runtime.questGoals);
                    
                    if (oldGoals === newGoals && this.runtime.questGoals.length > 0) {
                        // Goals haven't changed, maybe stuck? Let's try the action again for certain types.
                        const currentGoal = this.runtime.questGoals[this.runtime.currentGoalIndex];
                        if (currentGoal && currentGoal.type === 'mob') {
                            this.setStatusMessage(`Re-triggering action for ${currentGoal.type}`);
                            GAME.socket.emit('ga', { a: 15, type: 13 });
                        }
                        return;
                    }
                    
                    if (this.runtime.questGoals.length === 0) {
                        this.finishQuest();
                        return;
                    }
                    
                    const currentGoal = this.runtime.questGoals[this.runtime.currentGoalIndex];
                    
                    if (currentGoal.current >= currentGoal.required) {
                        this.setStatusMessage(`Goal ${this.runtime.currentGoalIndex + 1} complete.`);
                        this.runtime.currentGoalIndex++;
                        
                        if (this.runtime.currentGoalIndex >= this.runtime.questGoals.length) {
                            this.finishQuest();
                        } else {
                            this.processQuestByType();
                        }
                    } else {
                        this.setStatusMessage(`Progress: ${currentGoal.current}/${currentGoal.required} for goal ${this.runtime.currentGoalIndex + 1}`);
                    }
                },
                
                // Check quest completion
                checkQuestCompletion: function() {
                    if (!this.settings.active) return;
                    
                    if ($("#quest_con").length === 0) {
                        this.setStatusMessage("Quest window closed, assuming complete.");
                        this.markCurrentLocationComplete();
                        this.moveToNextLocation();
                    } else {
                        this.setStatusMessage("Quest window still open, checking content...");
                        this.analyzeQuestContent();
                        
                        if (this.runtime.questGoals.length === 0) {
                            this.useQuestProceed();
                        } else {
                            this.processQuestByType();
                        }
                    }
                },
                
                // Finish quest
                finishQuest: function() {
                    if (!this.settings.active) return;
                    
                    this.setStatusMessage("Finishing quest");
                    this.stopActivities();
                    this.useQuestProceed();
                },
                
                // Stop activities
                stopActivities: function() {
                    if ($("#res_Panel .res_status").hasClass("green")) {
                        $("#res_Panel .res_button.res_res").click();
                    }
                    if ($("#resp_Panel .resp_status").hasClass("green")) {
                        $("#resp_Panel .resp_button.resp_resp").click();
                    }
                    if ($("#pvp_Panel .pvp_status").hasClass("green")) {
                        $("#pvp_Panel .pvp_button.pvp_pvp").click();
                    }
                    if ($("#lpvm_Panel .lpvm_status").hasClass("green")) {
                        $("#lpvm_Panel .lpvm_button.lpvm_lpvm").click();
                    }
                    if (this.runtime.checkInterval) {
                        clearInterval(this.runtime.checkInterval);
                        this.runtime.checkInterval = null;
                    }
                },
                
                // Skip current quest
                skipCurrentQuest: function() {
                    this.setStatusMessage("Skipping quest");
                    this.stopActivities();
                    
                    if ($("#quest_con").length > 0) {
                        $("[data-option='close_quest']").click();
                    }
                    
                    this.markCurrentLocationComplete();
                    this.moveToNextLocation();
                },
                
                // Skip current location
                skipCurrentLocation: function() {
                    this.setStatusMessage("Skipping location: " + this.locations[this.runtime.currentLocationIndex].name);
                    this.stopActivities();
                    this.markCurrentLocationComplete();
                    this.moveToNextLocation();
                },
                
                // Mark current location complete
                markCurrentLocationComplete: function() {
                    if (this.runtime.currentLocationIndex < this.locations.length) {
                        this.locations[this.runtime.currentLocationIndex].completed = true;
                        this.updateQuestsList();
                        this.updateProgressCounter();
                    }
                },
                
                // Move to next location
                moveToNextLocation: function() {
                    if (!this.settings.active) return;
                    
                    this.setStatusMessage("Moving to next location...");
                    this.runtime.isProcessingQuest = false;
                    this.runtime.questType = null;
                    this.runtime.questGoals = [];
                    this.runtime.currentGoalIndex = 0;
                    
                    this.stopActivities();
                    
                    this.runtime.currentLocationIndex++;
                    this.findNextLocation();
                    
                    if (this.runtime.currentLocationIndex < this.locations.length) {
                        this.setStatusMessage("Next location: " + this.locations[this.runtime.currentLocationIndex].name);
                        this.updateQuestsList();
                        
                        setTimeout(() => {
                            if (!this.settings.active) return;
                            this.teleportToCurrentLocation();
                        }, 2000);
                    } else {
                        this.completeAllQuests();
                    }
                },
                
                // Complete all quests
                completeAllQuests: function() {
                    this.setStatusMessage("All quests completed!");
                    this.settings.active = false;
                    $(".dq_button.dq_toggle b").removeClass("green").addClass("red").html("Off");
                    this.updateQuestsList();
                    this.updateProgressCounter();
                },
                
                // Update quests list
                updateQuestsList: function() {
                    const $list = $('#dq_locations_list');
                    $list.empty();
                    
                    if (!this.locations || !Array.isArray(this.locations) || this.locations.length === 0) {
                        return;
                    }
                    
                    this.locations.forEach((location, index) => {
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
                        if (this.runtime.currentLocationIndex === index && this.settings.active) {
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
                },
                
                // Update progress counter
                updateProgressCounter: function() {
                    if (!this.locations || !Array.isArray(this.locations)) {
                        $('#dq_progress_count').text('0/0');
                        return;
                    }
                    
                    const total = this.locations.length;
                    const completed = this.locations.filter(loc => loc.completed).length;
                    $('#dq_progress_count').text(completed + '/' + total);
                },
                
                // Set status message
                setStatusMessage: function(message) {
                    $('#dq_status_message').text(message);
                    console.log("[DAILY QUESTS] " + message);
                },
                
                // Toggle skip quest type
                toggleSkipQuestType: function(type) {
                    if (this.settings.skipTypes.hasOwnProperty(type)) {
                        this.settings.skipTypes[type] = !this.settings.skipTypes[type];
                    }
                }
            };
            
            // Initialize after a short delay
            setTimeout(() => {
                window.DAILY_QUESTS.initialize();
            }, 1000);
        }
    }, 500);
}
