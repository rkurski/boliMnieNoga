/**
 * Daily Quests Locations
 * 
 * This file contains the list of locations for daily quests.
 * It can be easily edited without modifying the core logic.
 * 
 * Format:
 * - id: Location ID for teleportation
 * - name: Display name for the UI
 * - coords: Coordinates of the quest giver (x, y)
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

const DAILY_QUESTS_LOCATIONS = [
  {
    "id": "414",
    "name": "Wieczny Mrok",
    "coords": { "x": 14, "y": 22 }
  },
  {
    "id": "418",
    "name": "Zamarznięte Jezioro",
    "coords": { "x": 30, "y": 11 }
  },
  {
    "id": "618",
    "name": "Planeta Bogów - Wschód",
    "coords": { "x": 2, "y": 19 }
  },
  {
    "id": "650",
    "name": "Zachodnia Stolica",
    "coords": { "x": 15, "y": 17 }
  },
  {
    "id": "661",
    "name": "Planeta Beerusa",
    "coords": { "x": 32, "y": 10 }
  },
  {
    "id": "661",
    "name": "Planeta Beerusa",
    "coords": { "x": 26, "y": 12 }
  },
];

// Make locations available globally
window.DAILY_QUESTS_LOCATIONS = DAILY_QUESTS_LOCATIONS;
console.log("[DAILY QUESTS] Loaded " + DAILY_QUESTS_LOCATIONS.length + " quest locations");
