class ballReset {
    constructor() {
        this.synergy = 6;
        this.hasStarted = false;
        this.bonsCombinations = [];
        this.css = ` #ballResetPanel { position: absolute; top: 35px; right: 10px; z-index: 9999999; width: 445px; padding: 5px; background: #303131bd; border: solid #ffffff7a 1px; border-radius: 5px; display: none; user-select: none; } #ballResetPanel .controller { display: flex; flex-direction: column; align-items: stretch; margin-bottom: 2px; } #ballResetPanel .controller button { font-weight: bolder; border:solid black 1px; cursor: pointer; } #ballResetPanel .controller button.green { background: lime; color: black !important; } #ballResetPanel .controller button.red { background: red; color: black !important; } #ballResetPanel .controller button:first-child { border-bottom:none; background: #afd4f5; } #ballResetPanel .controller button:disabled { opacity: 1; background: gray; cursor: not-allowed; } #ballResetPanel .ballCombination { background: #dfdfdc5c; padding: 5px; margin-bottom: 2px; } #ballResetPanel .ballCombination .combinationID { text-align: center; background: black; color: white; font-weight: bolder; font-size: 16px; padding: 1px; margin-bottom: 2px; } #ballResetPanel .ballCombination select { margin-bottom: 2px; background: #ffffff99; border: solid #6f6f6f 1px; border-radius: 5px; color: black; } #ballResetPanel .ballCombination select:last-child { margin-bottom: 0px; } `;
        this.innerHTML = ` <div id="ballResetPanel"> <div class="controller"> <button class="addCombination">DODAJ NOWĄ KOMBINACJE</button> <button class="startSearching green">SZUKAJ</button> </div> <div class="combinations">${this.bonsCombination(1)}</div> </div> `;
        $("body").append(`<style>${this.css}</style>${this.innerHTML}`);
        $("body").on("click", "#ballResetPanel .addCombination", () => {
            let lastID = parseInt($(".ballCombination:last").attr("combination"));
            lastID++;
            $(".combinations").append(this.bonsCombination(lastID));
        });
        $("body").on("click", "#ballResetPanel .startSearching", () => {
            this.controller();
        });
        $("body").on("click", `button[data-option="ss_page"][data-page="reset"]`, () => {
            GAME.completeProgress = () => {
                var res = GAME.progress;
                switch (res.a) {
                    case 45:
                        if (res.ball) {
                            GAME.parseData(55, res);
                            if (this.hasStarted) {
                                this.search(res);
                            }
                        }
                        break;
                }
                delete GAME.progress;
            }
            $("#ballResetPanel").show();
        });
        $("body").on("click", `button[data-option="ss_page"][data-page="upgrade"], #soulstone_interface .closeicon`, () => {
            if (this.hasStarted) {
                $("#ballResetPanel .startSearching").click();
            }
            $('.ss_stats tr').css("background", "transparent");
            $("#ballResetPanel").hide();
            $("#ss_page_reset").hide();
        });
    }
    controller() {
        if (this.hasStarted) {
            this.hasStarted = false;
            $(".startSearching").removeClass("red").addClass("green").html("SZUKAJ");
            $(".ballCombination select").prop("disabled", false);
            $(".addCombination").prop("disabled", false);
        } else {
            this.hasStarted = true;
            this.search();
            $(".startSearching").removeClass("green").addClass("red").html("STOP");
            $(".ballCombination select").prop("disabled", true);
            $(".addCombination").prop("disabled", true);
        }
    }
    search(res = false) {
        if (this.hasStarted) {
            this.bonsCombinations = this.prepareCombinations();
            if (res) {
                this.ballActualBons = this.prepareBallBons(res);
            } else {
                this.ballActualBons = [0]
            }
            if (!this.compare(this.ballActualBons, this.bonsCombinations)) {
                GAME.socket.emit('ga', {
                    a: 45,
                    type: 1,
                    bid: GAME.ball_id
                });
            } else {
                $(".startSearching").click();
            }
        }
    }
    compare(pattern, others) {
        const patternCounts = this.countOccurrences(pattern);
        for (let i = 0; i < others.length; i++) {
            const other = others[i];
            const otherCounts = this.countOccurrences(other);
            let isValid = true;
            for (const [num, count] of Object.entries(otherCounts)) {
                if (!patternCounts[num] || patternCounts[num] < count) {
                    isValid = false;
                    break;
                }
            }
            if (isValid) {
                return true;
            }
        }
        return false;
    }
    countOccurrences(array) {
        const counts = {};
        for (const num of array) {
            counts[num] = (counts[num] || 0) + 1;
        }
        return counts;
    }
    prepareBallBons(res) {
        let ball = res.ball;
        let bons = [];
        $('.ss_stats tr').css("background", "transparent");
        for (var s = 1; s <= 9; s++) {
            if (ball['stat' + s] && this.bonsCombinations.some(array => array.includes(ball['stat' + s]))) {
                bons.push(ball['stat' + s]);
                $('#stat' + s + '_bon').parent().css("background", "#80008075");
            }
        }
        return bons;
    }
    prepareCombinations() {
        let combinations = [];
        $(".ballCombination").each((index, element) => {
            let combination = [];
            $(element).find("select").each((idx, sel) => {
                const value = parseInt($(sel).val());
                if (value > 0) {
                    combination.push(value);
                }
            });
            if (combination.length > 0) {
                combinations.push(combination);
            }
        });
        return combinations;
    }
    bonsCombination(c) {
        let innerHTML = `<div class="ballCombination" combination="${c}"><div class="combinationID">Kombinacja #${c}</div>`;
        for (let i = 0; i < this.synergy; i++) {
            innerHTML += `${this.listOfBons(c)}`;
        }
        innerHTML += "</div>";
        return innerHTML;
    }
    listOfBons() {
        let innerHTML = ` <select> <option value="0">Brak</option> `;
        this.allBons().forEach((obiekt) => {
            innerHTML += `<option value="${obiekt.id}">${obiekt.bonus}</option>`;
        });
        innerHTML += `</select>`;
        return innerHTML;
    }
    allBons() {
        return [{
            id: 13,
            bonus: '% do obrażeń'
        }, {
            id: 14,
            bonus: '% do redukcji obrażeń'
        }, {
            id: 15,
            bonus: '% do efektywności treningu'
        }, {
            id: 16,
            bonus: '% do doświadczenia'
        }, {
            id: 17,
            bonus: '% do szansy na trafienie krytyczne'
        }, {
            id: 18,
            bonus: '% do redukcji szansy na otrzymanie trafienia krytycznego'
        }, {
            id: 51,
            bonus: '% do obrażeń od technik'
        }, {
            id: 52,
            bonus: '% redukcji obrażeń od technik'
        }, {
            id: 53,
            bonus: '% do szansy na moc z walk PvM'
        }, {
            id: 54,
            bonus: '% do ilości mocy z walk PvM'
        }, {
            id: 55,
            bonus: '% do szansy na zdobycie przedmiotu z walk PvM'
        }, {
            id: 56,
            bonus: 'minut(a) krótsze wyprawy'
        }, {
            id: 57,
            bonus: '% do szansy powodzenia wypraw'
        }, {
            id: 58,
            bonus: '% do szansy na ulepszenie przedmiotów'
        }, {
            id: 59,
            bonus: '% do szansy na połączenie przedmiotów'
        }, {
            id: 60,
            bonus: '% do obrażeń od trafień krytycznych'
        }, {
            id: 61,
            bonus: '% redukcji obrażeń od trafień krytycznych'
        }, {
            id: 62,
            bonus: '% do mocy za wygrane walki wojenne'
        }, {
            id: 63,
            bonus: '% do skuteczności podpaleń'
        }, {
            id: 64,
            bonus: '% do skuteczności krwawień'
        }, {
            id: 65,
            bonus: '% do odporności na podpalenia'
        }, {
            id: 66,
            bonus: '% do odporności na krwawienia'
        }, {
            id: 67,
            bonus: '% do szansy na zdobycie PSK'
        }, {
            id: 68,
            bonus: '% do punktów PvP za wygrane walki'
        }, {
            id: 69,
            bonus: '% do szansy na 3x więcej punktów PvP za wygrane walki'
        }, {
            id: 70,
            bonus: '% do szansy na 3x więcej doświadczenia za wygrane walki PvM'
        }, {
            id: 71,
            bonus: '% do mocy za skompletowanie SK'
        }, {
            id: 72,
            bonus: '% do mocy za skompletowanie PSK'
        }, {
            id: 73,
            bonus: 'minut(y) do czasu trwania błogosławieństw'
        }, {
            id: 74,
            bonus: '% do szansy na spotkanie legendarnych potworów'
        }, {
            id: 75,
            bonus: 'minut(y) krótszy cooldown między walkami PvP'
        }, {
            id: 76,
            bonus: '% zwiększenie własnej szybkości'
        }, {
            id: 77,
            bonus: '% obniżenie szybkości przeciwnika'
        }, {
            id: 78,
            bonus: '% do szansy na zdobycie Niebieskiego Senzu'
        }, {
            id: 79,
            bonus: '% mniejsze obrażenia od podpaleń'
        }, {
            id: 80,
            bonus: '% mniejsze obrażenia od krwawień'
        }, {
            id: 81,
            bonus: '% do szansy na zdobycie Scoutera'
        }, {
            id: 91,
            bonus: '% do wtajemniczenia'
        }, {
            id: 99,
            bonus: '% większy limit dzienny Niebieskich Senzu'
        }, {
            id: 139,
            bonus: '% do ilości zdobywanych kryształów instancji'
        }, {
            id: 140,
            bonus: '% do przyrostu Punktów Akcji'
        }, {
            id: 154,
            bonus: '% do sławy za walki w wojnach imperiów'
        }, {
            id: 160,
            bonus: '% do boskiego atrybutu przewodniego'
        }, {
            id: 163,
            bonus: '% więcej Boskiej Ki za CSK'
        }, {
            id: 171,
            bonus: '% do max Punktów Akcji'
        }];
    }
}