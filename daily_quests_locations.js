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

// Define locations array
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
