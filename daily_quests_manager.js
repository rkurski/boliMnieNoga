/**
 * Daily Quests Manager
 * 
 * This file adds daily quests automation to the existing AFO system.
 * It is designed to be loaded after the main AFO script.
 */

// Create the DAILY_QUESTS object if it doesn't exist
if (typeof DAILY_QUESTS === 'undefined') {
    // Define helper functions first to avoid "not defined" errors
    function updateDailyQuestsUI() {
        updateQuestsList();
        updateProgressCounter();
    }

    function updateQuestsList() {
        const $list = $('#dq_locations_list');
        $list.empty();
        
        if (!DAILY_QUESTS || !DAILY_QUESTS.locations) return;
        
        DAILY_QUESTS.locations.forEach((location, index) => {
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
            if (DAILY_QUESTS.runtime.currentLocationIndex === index && DAILY_QUESTS.settings.active) {
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
    }

    function updateProgressCounter() {
        if (!DAILY_QUESTS || !DAILY_QUESTS.locations) return;
        
        const total = DAILY_QUESTS.locations.length;
        const completed = DAILY_QUESTS.locations.filter(loc => loc.completed).length;
        $('#dq_progress_count').text(completed + '/' + total);
    }

    function setStatusMessage(message) {
        $('#dq_status_message').text(message);
    }

    var DAILY_QUESTS = {
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
            },
            waitTime: 40 // Default wait time between actions
        },
        runtime: {
            currentLocationIndex: 0,
            path: [],
            isProcessingQuest: false,
            isMoving: false,
            questType: null,
            questGoals: [],
            currentGoalIndex: 0,
            checkInterval: null,
            lastActionTime: 0,
            matrix: [] // Matrix for pathfinding
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

        initialize: function() {
            this.initializeLocations();
            this.initializeUI();
            this.setupEventHandlers();
            console.log("[DAILY QUESTS] Manager initialized");
        },

        initializeLocations: function() {
            if (window.DAILY_QUESTS_LOCATIONS) {
                this.locations = window.DAILY_QUESTS_LOCATIONS.map(loc => ({
                    ...loc,
                    disabled: false,
                    completed: false
                }));
            } else {
                console.error("[DAILY QUESTS] Locations not found!");
            }
        },

        initializeUI: function() {
            updateQuestsList();
            updateProgressCounter();
        },

        setupEventHandlers: function() {
            // Setup event handlers for the daily quests panel
            $("body").on("click", ".dq_button.dq_start_stop", () => {
                const isActive = this.toggleActive();
                if (isActive) {
                    $(".dq_button.dq_start_stop b").removeClass("red").addClass("green").html("On");
                } else {
                    $(".dq_button.dq_start_stop b").removeClass("green").addClass("red").html("Off");
                }
            });
            
            $("body").on("click", ".dq_button.dq_reset", () => {
                this.resetProgress();
            });
            
            $("body").on("change", ".dq_location_toggle", function() {
                const index = $(this).closest(".dq_location").data("index");
                DAILY_QUESTS.toggleLocationEnabled(index);
            });
            
            // Setup the main panel button handler if not already set
            if (!$._data($("#main_Panel .gh_daily_quests")[0], "events")) {
                $("#main_Panel .gh_daily_quests").click(() => {
                    if ($(".gh_daily_quests .gh_status").hasClass("red")) {
                        $(".gh_daily_quests .gh_status").removeClass("red").addClass("green").html("On");
                        $("#daily_quests_Panel").show();
                        this.initializeUI();
                    } else {
                        $(".gh_daily_quests .gh_status").removeClass("green").addClass("red").html("Off");
                        $("#daily_quests_Panel").hide();
                        if (this.settings.active) {
                            $(".dq_button.dq_start_stop b").removeClass("green").addClass("red").html("Off");
                            this.toggleActive();
                        }
                    }
                });
            }
        },

        toggleActive: function() {
            this.settings.active = !this.settings.active;
            
            if (this.settings.active) {
                this.startQuestProcessing();
            } else {
                this.stopQuestProcessing();
            }
            
            return this.settings.active;
        },
        
        toggleLocationEnabled: function(index) {
            if (index >= 0 && index < this.locations.length) {
                this.locations[index].disabled = !this.locations[index].disabled;
                updateQuestsList();
            }
        },
        
        resetProgress: function() {
            this.locations.forEach(loc => {
                loc.completed = false;
            });
            this.runtime.currentLocationIndex = 0;
            updateQuestsList();
            updateProgressCounter();
            setStatusMessage("Progress reset");
        },
        
        startQuestProcessing: function() {
            this.findNextLocation();
            
            if (this.runtime.currentLocationIndex < this.locations.length) {
                setStatusMessage("Starting quest at " + this.locations[this.runtime.currentLocationIndex].name);
                updateQuestsList();
                this.teleportToCurrentLocation();
            } else {
                setStatusMessage("All quests completed!");
                this.settings.active = false;
                // Update button state
                $(".dq_button.dq_start_stop b").removeClass("green").addClass("red").html("Off");
            }
        },
        
        stopQuestProcessing: function() {
            if (this.runtime.checkInterval) {
                clearInterval(this.runtime.checkInterval);
                this.runtime.checkInterval = null;
            }
            
            this.runtime.isProcessingQuest = false;
            this.runtime.isMoving = false;
            this.runtime.path = [];
            this.stopActivities(); // Ensure activities are stopped
            setStatusMessage("Quest processing stopped");
            updateQuestsList();
        },
        
        findNextLocation: function() {
            for (let i = this.runtime.currentLocationIndex; i < this.locations.length; i++) {
                if (!this.locations[i].completed && !this.locations[i].disabled) {
                    this.runtime.currentLocationIndex = i;
                    return;
                }
            }
            this.runtime.currentLocationIndex = this.locations.length;
        },
        
        teleportToCurrentLocation: function() {
            if (this.runtime.currentLocationIndex >= this.locations.length) {
                this.completeAllQuests();
                return;
            }
            
            const location = this.locations[this.runtime.currentLocationIndex];
            setStatusMessage("Teleporting to " + location.name);
            
            GAME.socket.emit('ga', {
                a: 12,
                type: 18,
                loc: parseInt(location.id)
            });
            
            setTimeout(() => {
                if (!this.settings.active) return; // Check if stopped during timeout
                this.findPathToQuestGiver();
            }, 3000);
        },
        
        findPathToQuestGiver: function() {
            if (!this.settings.active) return;
            
            const location = this.locations[this.runtime.currentLocationIndex];
            setStatusMessage("Finding path to quest giver in " + location.name);
            
            this.createMatrix();
            
            const targetX = location.coords.x - 1;
            const targetY = location.coords.y - 1;
            const startX = GAME.char_data.x - 1;
            const startY = GAME.char_data.y - 1;
            
            LPVM.Finder.setGrid(this.runtime.matrix);
            LPVM.Finder.findPath(startX, startY, targetX, targetY, (path) => {
                if (!this.settings.active) return; // Check if stopped during pathfinding
                if (path === null) {
                    setStatusMessage("No path found to quest giver!");
                    this.skipCurrentLocation();
                } else {
                    if (path.length > 0 && path[0].x == startX && path[0].y == startY) {
                        path.shift();
                    }
                    this.runtime.path = path;
                    this.moveAlongPath();
                }
            });
            LPVM.Finder.calculate();
        },
        
        createMatrix: function() {
            this.runtime.matrix = [];
            const mapData = GAME.mapcell;
            
            for (let i = 0; i < parseInt(GAME.map.max_y); i++) {
                this.runtime.matrix[i] = [];
                for (let j = 0; j < parseInt(GAME.map.max_x); j++) {
                    if (mapData[parseInt(j + 1) + '_' + parseInt(i + 1)].m == 1) {
                        this.runtime.matrix[i][j] = 1;
                    } else {
                        this.runtime.matrix[i][j] = 0;
                    }
                }
            }
        },
        
        moveAlongPath: function() {
            if (!this.settings.active || this.runtime.path.length === 0) {
                this.runtime.isMoving = false;
                return;
            }
            
            this.runtime.isMoving = true;
            const nextStep = this.runtime.path[0];
            const charX = GAME.char_data.x - 1;
            const charY = GAME.char_data.y - 1;
            let direction = -1;

            if (nextStep.x > charX && nextStep.y == charY) direction = 2; // Right
            else if (nextStep.x < charX && nextStep.y == charY) direction = 6; // Left
            else if (nextStep.x == charX && nextStep.y < charY) direction = 0; // Up
            else if (nextStep.x == charX && nextStep.y > charY) direction = 4; // Down
            else if (nextStep.x > charX && nextStep.y < charY) direction = 1; // Up-right
            else if (nextStep.x < charX && nextStep.y < charY) direction = 7; // Up-left
            else if (nextStep.x > charX && nextStep.y > charY) direction = 3; // Down-right
            else if (nextStep.x < charX && nextStep.y > charY) direction = 5; // Down-left

            if (direction !== -1) {
                 GAME.socket.emit('ga', {
                    a: 4,
                    dir: direction,
                    vo: GAME.map_options.vo
                });
            }
           
            this.runtime.path.shift();
            
            setTimeout(() => {
                if (!this.settings.active) return; // Check if stopped during timeout
                if (this.runtime.path.length > 0) {
                    this.moveAlongPath();
                } else {
                    this.runtime.isMoving = false;
                    this.interactWithQuestGiver();
                }
            }, this.settings.waitTime);
        },
        
        interactWithQuestGiver: function() {
            if (!this.settings.active) return;
            setStatusMessage("Interacting with quest giver");
            
            GAME.socket.emit('ga', { a: 2 });
            
            setTimeout(() => {
                if (!this.settings.active) return; // Check if stopped during timeout
                this.processCurrentQuest(); // Changed from startQuestProcessing to avoid loop
            }, 1000);
        },
        
        processCurrentQuest: function() {
            if (!this.settings.active) return;
            
            this.runtime.isProcessingQuest = true;
            setStatusMessage("Processing quest");
            
            if ($("#quest_con").length === 0) {
                setStatusMessage("Quest window not found. Retrying interaction...");
                // Maybe the quest was instantly completed or failed to open
                // Let's try moving to the next location after a delay
                setTimeout(() => {
                    if (!this.settings.active) return;
                    this.markCurrentLocationComplete(); // Assume complete if window closed quickly
                    this.moveToNextLocation();
                }, 2000);
                return;
            }
            
            this.analyzeQuestContent();
            
            if (this.runtime.questType) {
                this.processQuestByType();
            } else {
                setStatusMessage("Unknown quest type, using default action.");
                this.useQuestProceed();
            }
        },
        
        analyzeQuestContent: function() {
            const $questDesc = $("#quest_con .quest_desc");
            if ($questDesc.length === 0) {
                this.runtime.questType = null;
                this.runtime.questGoals = [];
                return;
            }
            const questContentHTML = $questDesc.html(); // Use html() to preserve structure for regex
            this.runtime.questType = null;
            this.runtime.questGoals = [];
            this.runtime.currentGoalIndex = 0; // Reset goal index

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
        
        determineMobType: function(description) {
            // Simplified: Check for keywords. Adjust if more specific types needed.
            if (description.includes("Elitarny")) return 1;
            if (description.includes("Czempion")) return 2;
            if (description.includes("Bossek")) return 3;
            return 0; // Default to Normalny
        },
        
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
        
        processQuestByType: function() {
            if (!this.settings.active) return;
            if (this.runtime.questGoals.length === 0 || this.runtime.currentGoalIndex >= this.runtime.questGoals.length) {
                // No goals or all goals processed, try to finish
                this.finishQuest();
                return;
            }

            const currentGoal = this.runtime.questGoals[this.runtime.currentGoalIndex];
            const questType = currentGoal.type.toUpperCase(); // Use goal type

            if (this.settings.skipTypes[questType]) {
                setStatusMessage("Skipping " + questType + " quest");
                this.skipCurrentQuest();
                return;
            }
            
            setStatusMessage("Processing " + questType + " quest goal");
            
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
        
        processResourceQuest: function() {
            setStatusMessage("Collecting resources");
            this.startProgressChecking();
            if ($("#res_Panel .res_status").hasClass("red")) {
                $("#res_Panel .res_button.res_res").click();
            }
            // Also try to click the resource on the map if available
            if ($(".map_res_cont").length > 0) {
                 GAME.socket.emit('ga', { a: 3 });
            }
        },
        
        processMobQuest: function() {
            setStatusMessage("Hunting mobs");
            this.startProgressChecking();
            const currentGoal = this.runtime.questGoals[this.runtime.currentGoalIndex];
            this.configureMobSpawner(currentGoal.mobType);
            
            if ($("#resp_Panel .resp_status").hasClass("red")) {
                $("#resp_Panel .resp_button.resp_resp").click();
            }
            // Trigger multi-fight
            GAME.socket.emit('ga', { a: 15, type: 13 });
        },
        
        configureMobSpawner: function(mobType) {
            // Ensure only the correct mob type is targeted
            // This assumes the RESP object and panel structure exists
            const types = [RESP.Blue, RESP.Green, RESP.Purple, RESP.Yellow, RESP.Red]; // Assuming these correspond to mob types 0-4
            const buttons = [$("#resp_Panel .resp_blue"), $("#resp_Panel .resp_green"), $("#resp_Panel .resp_purple"), $("#resp_Panel .resp_yellow"), $("#resp_Panel .resp_red")];
            
            for(let i=0; i < buttons.length; i++) {
                const shouldBeActive = (i === mobType);
                const currentStatus = buttons[i].find('.resp_status').hasClass('green');
                if (shouldBeActive && !currentStatus) {
                    buttons[i].click(); // Activate if needed
                } else if (!shouldBeActive && currentStatus) {
                    buttons[i].click(); // Deactivate if needed
                }
            }
            // Ensure main RESP is active
             if ($("#resp_Panel .resp_resp .resp_status").hasClass("red")) {
                $("#resp_Panel .resp_resp").click();
            }
        },
        
        processPlayerQuest: function() {
            setStatusMessage("Starting PVP");
            this.startProgressChecking();
            if ($("#pvp_Panel .pvp_status").hasClass("red")) {
                $("#pvp_Panel .pvp_button.pvp_pvp").click();
            }
        },
        
        processLPVMQuest: function() {
            setStatusMessage("Starting LPVM");
            this.startProgressChecking();
            if ($("#lpvm_Panel .lpvm_status").hasClass("red")) {
                $("#lpvm_Panel .lpvm_button.lpvm_lpvm").click();
            }
        },
        
        processExpeditionQuest: function() {
            setStatusMessage("Processing expedition quest");
            this.useQuestProceed(); // Use default action
        },
        
        processInstanceQuest: function() {
            setStatusMessage("Processing instance quest");
             this.useQuestProceed(); // Use default action
        },
        
        processDonationQuest: function() {
            setStatusMessage("Processing donation quest");
            this.useQuestProceed(); // Use default action
        },
        
        useQuestProceed: function() {
            setStatusMessage("Using default quest action");
            // Use the existing questProceed method if available in the scope
            // Assuming questProceed is globally available or part of another object like `kwsv3`
            if (typeof questProceed === 'function') {
                questProceed();
            } else if (typeof kwsk === 'object' && typeof kwsk.questProceed === 'function') {
                 kwsk.questProceed(); // Assuming 'kwsk' is the instance name if it's from script1-2.js
            } else {
                 // Fallback: try clicking the first available option in the quest window
                 const $questOption = $("#quest_con .option:not(.closeicon)").first();
                 if ($questOption.length > 0) {
                     $questOption.click();
                 } else {
                     setStatusMessage("No default action found!");
                     this.skipCurrentQuest(); // Skip if no action possible
                     return;
                 }
            }
            
            // Check completion after a delay
            setTimeout(() => {
                 if (!this.settings.active) return;
                this.checkQuestCompletion();
            }, 2000);
        },
        
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
        
        checkQuestProgress: function() {
            if (!this.settings.active || !this.runtime.isProcessingQuest || $("#quest_con").length === 0) {
                if (this.runtime.checkInterval) {
                    clearInterval(this.runtime.checkInterval);
                    this.runtime.checkInterval = null;
                }
                return;
            }
            
            const oldGoals = JSON.stringify(this.runtime.questGoals); // Store old state
            this.analyzeQuestContent(); // Re-analyze to get updated progress
            const newGoals = JSON.stringify(this.runtime.questGoals);

            if (oldGoals === newGoals && this.runtime.questGoals.length > 0) {
                // Goals haven't changed, maybe stuck? Let's try the action again for certain types.
                const currentGoal = this.runtime.questGoals[this.runtime.currentGoalIndex];
                if (currentGoal && (currentGoal.type === 'mob' || currentGoal.type === 'pvp' || currentGoal.type === 'lpvm')) {
                    setStatusMessage(`Re-triggering action for ${currentGoal.type}`);
                    if (currentGoal.type === 'mob') GAME.socket.emit('ga', { a: 15, type: 13 });
                    // PVP/LPVM should be running via their own loops, no need to re-trigger start
                }
                return; // Don't proceed if goals haven't updated unless re-triggering
            }

            if (this.runtime.questGoals.length === 0) {
                 // Quest might be complete or changed state
                 this.finishQuest();
                 return;
            }

            const currentGoal = this.runtime.questGoals[this.runtime.currentGoalIndex];
            
            if (currentGoal.current >= currentGoal.required) {
                setStatusMessage(`Goal ${this.runtime.currentGoalIndex + 1} complete.`);
                this.runtime.currentGoalIndex++;
                
                if (this.runtime.currentGoalIndex >= this.runtime.questGoals.length) {
                    this.finishQuest();
                } else {
                    this.processQuestByType(); // Process the next goal
                }
            } else {
                 // Goal not yet complete, continue current action (implicitly handled by external loops like RESP/PVP/LPVM or re-triggers)
                 setStatusMessage(`Progress: ${currentGoal.current}/${currentGoal.required} for goal ${this.runtime.currentGoalIndex + 1}`);
            }
        },
        
        checkQuestCompletion: function() {
            if (!this.settings.active) return;
            if ($("#quest_con").length === 0) {
                setStatusMessage("Quest window closed, assuming complete.");
                this.markCurrentLocationComplete();
                this.moveToNextLocation();
            } else {
                // Quest window still open, maybe needs another interaction
                setStatusMessage("Quest window still open, checking content...");
                this.analyzeQuestContent(); // Re-analyze
                if (this.runtime.questGoals.length === 0) { // If analysis shows no goals, assume it's a simple dialog
                     this.useQuestProceed(); // Try proceeding again
                } else {
                     // Goals exist, let the progress checker handle it or re-process
                     this.processQuestByType();
                }
            }
        },
        
        finishQuest: function() {
            if (!this.settings.active) return;
            setStatusMessage("Finishing quest");
            this.stopActivities();
            
            // Try to click the finish/continue button
            this.useQuestProceed(); 
        },
        
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
        
        skipCurrentQuest: function() {
            setStatusMessage("Skipping quest");
            this.stopActivities();
            if ($("#quest_con").length > 0) {
                $("[data-option='close_quest']").click();
            }
            // Even if skipped, mark location as done for this run
            this.markCurrentLocationComplete(); 
            this.moveToNextLocation();
        },
        
        skipCurrentLocation: function() {
            setStatusMessage("Skipping location: " + this.locations[this.runtime.currentLocationIndex].name);
            this.stopActivities();
             // Mark as completed for this run to avoid retrying
            this.markCurrentLocationComplete();
            this.moveToNextLocation();
        },
        
        markCurrentLocationComplete: function() {
            if (this.runtime.currentLocationIndex < this.locations.length) {
                this.locations[this.runtime.currentLocationIndex].completed = true;
                updateQuestsList();
                updateProgressCounter();
            }
        },
        
        moveToNextLocation: function() {
            if (!this.settings.active) return;
            setStatusMessage("Moving to next location...");
            this.runtime.isProcessingQuest = false;
            this.runtime.isMoving = false;
            this.runtime.path = [];
            this.runtime.questType = null;
            this.runtime.questGoals = [];
            this.runtime.currentGoalIndex = 0;
            
            this.stopActivities();
            
            this.runtime.currentLocationIndex++;
            this.findNextLocation();
            
            if (this.runtime.currentLocationIndex < this.locations.length) {
                setStatusMessage("Next location: " + this.locations[this.runtime.currentLocationIndex].name);
                updateQuestsList();
                setTimeout(() => {
                    if (!this.settings.active) return;
                    this.teleportToCurrentLocation();
                }, 2000);
            } else {
                this.completeAllQuests();
            }
        },
        
        completeAllQuests: function() {
            setStatusMessage("All quests completed!");
            this.settings.active = false;
            // Update button state
            $(".dq_button.dq_start_stop b").removeClass("green").addClass("red").html("Off");
            updateQuestsList();
            updateProgressCounter();
        },
        
        // Settings management
        toggleSkipQuestType: function(type) {
            if (this.settings.skipTypes.hasOwnProperty(type)) {
                this.settings.skipTypes[type] = !this.settings.skipTypes[type];
            }
        },
        
        setWaitTime: function(time) {
            this.settings.waitTime = parseInt(time) || 40;
        }
    };

    // Initialize after page is fully loaded
    $(document).ready(function() {
        // Wait a bit to ensure AFO is fully loaded
        setTimeout(function() {
            DAILY_QUESTS.initialize();
        }, 2000);
    });
}
