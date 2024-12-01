class ekwipunekMenager {
    constructor() {
        const otwieranieKart = new cardOpen();
        const mapWrapper = new locationWrapper();
        this.setupCalculatePA();
    }

    setupCalculatePA() {
        const ekwipunekButton = document.querySelector('button.select_page[data-page="game_ekw"]');

        if (ekwipunekButton) {
            ekwipunekButton.addEventListener('click', () => {
                console.log("Przycisk Ekwipunek kliknięty.");
                this.createOrUpdatePADisplay();
            });
        } else {
            console.error("Nie znaleziono przycisku Ekwipunek!");
        }
    }

    createOrUpdatePADisplay() {
        const titleDiv = document.querySelector("#page_game_ekw > div.title");
        if (!titleDiv) return;

        let paDiv = document.getElementById("pa_display");

        if (!paDiv) {
            paDiv = document.createElement("div");
            paDiv.id = "pa_display";
            paDiv.innerText = `POSIADANE PA: OBLICZ`;
            paDiv.style.display = "inline-block";
            paDiv.style.color = "lightblue";
            paDiv.style.fontSize = "16px";
            paDiv.style.fontWeight = "bold";
            paDiv.style.cursor = "pointer";
            paDiv.style.position = "relative";
            paDiv.style.left = "40%";
            titleDiv.appendChild(paDiv);
            paDiv.addEventListener("click", () => {
                console.log("Obliczanie PA rozpoczęte...");
                new calculatePA();
            });
        }
    }
}

class cardOpen {
    constructor() {
        $("body").on("click", '#ekw_page_items div[data-base_item_id="1784"]', () => {
            $("#ekw_menu_use").one("click", () => {
                setTimeout(() => {
                    $(`<button class="btn_small_gold otwieranie_kart" style="margin-right:4ch;">X100 OPEN</button>`).insertBefore("#kom_con > div > div.content > div:nth-child(1) > button.option.btn_small_gold");
                }, 500);
            });
        });
        $("body").on("click", '.otwieranie_kart', () => {
            let upperLimit = parseInt(document.querySelector("#item_am").value, 10);
            if (!isNaN(upperLimit) && upperLimit > 0) {
                for (let i = 0; i < upperLimit; i++) {
                    setTimeout(() => {
                        let cards = $(`#ekw_page_items div[data-base_item_id="1784"]`);
                        let cards_id = parseInt(cards.attr("data-item_id"));
                        GAME.socket.emit('ga', { a: 12, type: 14, iid: cards_id, page: GAME.ekw_page, page2: GAME.ekw_page2, am: '100' });
                    }, i * 2000);
                }
            } else {
                console.error("Wartość #item_am nie jest poprawną liczbą lub jest mniejsza niż 1.");
            }
        });
    }
}

class calculatePA {
    constructor() {
        this.calculateFinalNumber().catch(error => {
            console.error("Błąd podczas obliczania PA:", error);
        });
    }

    async calculateFinalNumber() {
        const initialPA = parseInt(document.querySelector("#char_pa_max").innerText.replace(/\s+/g, ''), 10);
        let finalNumber = initialPA;

        const itemStacks = await this.getItemStacks([1244, 1242, 1259, 1473, 1260, 1472, 1243, 1471, 1494, 1493, 1492, 1489, 1485, 1484, 1483]);

        finalNumber += itemStacks[1244] * 100;
        finalNumber += itemStacks[1242] * 2000;
        finalNumber += itemStacks[1259] * 5000 + (initialPA * 0.03);
        finalNumber += itemStacks[1473] * 5000 + (initialPA * 0.03);
        finalNumber += itemStacks[1260] * 10000 + (initialPA * 0.15);
        finalNumber += itemStacks[1472] * 10000 + (initialPA * 0.15);
        finalNumber += itemStacks[1243] * initialPA;
        finalNumber += itemStacks[1471] * initialPA;
        finalNumber += (itemStacks[1489] * 5000 + (initialPA * 0.03)) * 20;
        finalNumber += (itemStacks[1489] * 10000 + (initialPA * 0.15)) * 3;
        finalNumber += (itemStacks[1494] * 10000 + (initialPA * 0.15)) * 3;
        finalNumber += (itemStacks[1493] * 10000 + (initialPA * 0.15)) * 3;
        finalNumber += (itemStacks[1492] * 10000 + (initialPA * 0.15)) * 3;
        finalNumber += (itemStacks[1485] * 10000 + (initialPA * 0.15)) * 3;
        finalNumber += (itemStacks[1483] * 10000 + (initialPA * 0.15)) * 3;
        finalNumber += (itemStacks[1484] * 10000 + (initialPA * 0.15)) * 3;
        finalNumber += (itemStacks[1484] * initialPA) * 4;

        this.updatePA(GAME.dots(finalNumber));
        console.log("MAX PA:" + initialPA + " Łączna ilość:" + finalNumber);
    }

    async getItemStacks(itemIds) {
        const stacks = {};
        itemIds.forEach(id => stacks[id] = 0);
        const pages = [
            { page: 0, page2: 0 },
            { page: 0, page2: 1 },
            { page: 0, page2: 2 }
        ];
        for (let page of pages) {
            await GAME.socket.emit('ga', { a: 12, page: page.page, page2: page.page2, used: 1 });
            await new Promise(resolve => setTimeout(resolve, 1500));
            itemIds.forEach(itemId => {
                const itemElement = document.querySelector(`#ekw_page_items [data-base_item_id="${itemId}"]`);
                if (itemElement) {
                    const stack = parseInt(itemElement.getAttribute('data-stack'), 10) || 0;
                    stacks[itemId] += stack;
                }
            });
        }
        // console.log(stacks);
        return stacks;
    }

    updatePA(finalNumber) {
        const paDiv = document.getElementById("pa_display");
        if (paDiv) {
            paDiv.innerText = `POSIADANE PA: ${finalNumber}`;
        }
    }
}

class locationWrapper {
    constructor() {
        this.locationsGathered = false;
        $("body").on("click", '#map_link_btn', () => {
            if ($("#changeLocationWrapper").length === 0) {
                let locationWrapperCSS = `
                #changeLocationWrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    margin-top: -50px;
                    position: relative; /* Pozycjonowanie względne */
                    z-index: 10; /* Wyższy z-index, aby kontener był nad innymi elementami */
                }
                #changeLocationWrapper .arrow {
                    width: 50px;
                    height: 50px;
                    background: linear-gradient(135deg, rgb(36 210 210 / 80%), rgb(46 215 215 / 10%));
                    color: white;
                    font-size: 20px;
                    font-weight: bold;
                    border: none;
                    border-radius: 50%;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                    position: relative; /* Pozycjonowanie względne */
                    z-index: 20; /* Zwiększamy z-index, aby strzałki były na wierzchu */
                }
                #changeLocationWrapper .arrow:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 10px rgba(0, 0, 0, 0.3);
                }
                #changeLocationText {
                    font-size: 18px;
                    color: rgb(36 210 210 / 80%);
                    font-weight: bold;
                    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.1);
                    white-space: nowrap; /* Zapobiega zawijaniu tekstu */
                }`;
                let locationWrapperHTML = `
                <div id="changeLocationWrapper">
                    <button id="leftArrow" class="arrow">← </button>
                    <span id="changeLocationText" class="green"> ZMIEŃ LOKACJĘ </span>
                    <button id="rightArrow" class="arrow"> →</button>
                </div>`;

                $('#map_y').after(`<style>${locationWrapperCSS}</style>${locationWrapperHTML}`);
            }
            if (!this.locationsGathered) {
                this.locationsGathered = true;
                setTimeout(() => {
                    GAME.emitOrder({ a: 19, type: 1 });
                    setTimeout(() => { document.querySelector("#map_link_btn").click(); }, 1000);
                    setTimeout(() => {
                        const dataLocArray = [];
                        const list = document.querySelector('#tp_list');
                        if (list) {
                            const items = list.querySelectorAll("[data-loc]");
                            items.forEach(item => {
                                const dataLocValue = item.getAttribute("data-loc");
                                if (dataLocValue && /^\d{1,4}$/.test(dataLocValue)) {
                                    dataLocArray.push(dataLocValue);
                                }
                            });
                            // console.log("Zebrane lokalizacje:", dataLocArray);
                        } else {
                            console.error("Element o ID #tp_list nie został znaleziony.");
                        }
                        $('#rightArrow').on('click', function () {
                            const currentLoc = String(GAME.char_data.loc);
                            const currentIndex = dataLocArray.indexOf(currentLoc);
                            if (currentIndex === -1) {
                                console.error("BRAK");
                            } else if (currentIndex > 0) {
                                const previousLoc = dataLocArray[currentIndex - 1];
                                GAME.emitOrder({ a: 12, type: 18, loc: previousLoc });
                            }
                        });
                        $('#leftArrow').on('click', function () {
                            const currentLoc = String(GAME.char_data.loc);
                            const currentIndex = dataLocArray.indexOf(currentLoc);
                            if (currentIndex === -1) {
                                console.error("BRAK");
                            } else if (currentIndex < dataLocArray.length - 1) {
                                const nextLoc = dataLocArray[currentIndex + 1];
                                GAME.emitOrder({ a: 12, type: 18, loc: nextLoc });
                            }
                        });
                    }, 1000);
                }, 2000);
            }
        });
    }
}



