class KwsCharactersManager {
    constructor() {
        this.characters = [];
        this.currentCharacterId = 0;
        this.currentIndex = 0;
        this.shouldReport = true;
    }
    setCurrentCharacterId(charId) {
        this.currentCharacterId = charId;
        this.currentIndex = this.characters.findIndex((value, index, array) => {
            return value == charId;
        });
    }
    getNextCharId() {
        if (this.characters.length == 1) {
            return this.currentCharacterId;
        }

        var returnCharId;

        if (this.currentIndex == this.characters.length - 1) {
            returnCharId = this.characters[0];
        } else {
            returnCharId = this.characters[this.currentIndex + 1];
        }

        this.setCurrentCharacterId(returnCharId);

        return returnCharId;
    }
    getPreviousCharId() {
        if (this.characters.length == 1) {
            return this.currentCharacterId;
        }

        var returnCharId;

        if (this.currentIndex == 0) {
            returnCharId = this.characters[this.characters.length - 1];
        } else {
            returnCharId = this.characters[this.currentIndex - 1];
        }

        this.setCurrentCharacterId(returnCharId);

        return returnCharId;
    }
}

function getCharacters() {
    if ($("#server_choose").is(":visible")) {
        if (this.shouldReport) {
            $("#logout").eq(0).click();
            this.shouldReport = false;
        }
    }
    var allCharacters = [...$("li[data-option=select_char]")];
    if (allCharacters.length == 0) {
        setTimeout(getCharacters, 200);
    } else {
        var kwsCharactersManager = new KwsCharactersManager();
        allCharacters.forEach((element, index, array) => {
            kwsCharactersManager.characters.push(element.getAttribute("data-char_id"));
        });
        kwsLocalCharacters = kwsCharactersManager;
    }
}

var kwsLocalCharacters = undefined;
getCharacters();