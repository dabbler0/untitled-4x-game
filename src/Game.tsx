import React, { useRef, useEffect, useState } from 'react';
import { GiHouse, GiWheat, GiCampingTent, GiWoodenCrate,
  GiFlyingFlag, GiWreckingBall, GiWarPick, GiBoatFishing, GiWoodPile, GiPlantWatering, GiStrawberry, GiTwoCoins,
  GiIonicColumn, GiStonePile
} from 'react-icons/gi';
import { AiOutlineClose } from 'react-icons/ai';
import { Coordinate, parsePosition, formatPosition } from './Coordinate';
import { Globe, Pop, Building, Board, GoodMap } from './Model';
import { House, Farm, Storehouse, ExpeditionBase, Fishery, Loggery, IrrigatedFarm, GatheringHut, TradingPost, Haven, Encampment } from './Data';
import { CanvasRenderer, gridToCartesian } from './CanvasRenderer';
import { PERLIN } from './PERLIN';

type Props = {
};

type ResourceDisplayProps = {
  value: GoodMap;
}

const iconMap: { [g: string]: React.FC } = {
  'food': GiWheat,
  'wood': GiWoodPile,
  'stone': GiStonePile,
};

const ResourceDisplay: React.FC<ResourceDisplayProps> = ({ value }) => {
  return (
    <span style={{ padding: 5 }}>
      {
        Object.keys(value).map((key) =>
          (<span style={{borderRadius: 5, border: '1px solid black', padding: 5, margin: 5 }}>
            {value[key]} {key in iconMap ? iconMap[key]({}): key}
          </span>)
        )
      }
    </span>);
}

const Game: React.FC<Props> = (args) => {
  // console.log(GiIonicColumn({}).props.children[0].props.d);
  const globe =  useRef<Globe>(new Globe(12, 5));
  const board = useRef<Board>(globe.current.getBoard({x : 0, y: 0 }));
  const logElement = useRef<HTMLDivElement>(null);
  const logs = useRef<string[]>([]);
  const [day, setDay] = useState(0);
  const [currentPops, setCurrentPops] = useState(0);
  const [currentExports, setCurrentExports] = useState<GoodMap>({});
  const [currentImports, setCurrentImports] = useState<GoodMap>({});
  const [currentProduction, setCurrentProduction] = useState<GoodMap>({});
  const [currentAverageProduction, setCurrentAverageProduction] = useState<GoodMap>({});
  const [currentSurplus, setCurrentSurplus] = useState<GoodMap>({});
  const [currentDemand, setCurrentDemand] = useState<GoodMap>({});
  const [currentPrices, setCurrentPrices] = useState<GoodMap>({});

  const [showCityPopup, setShowCityPopup] = useState(false);

  const [alreadyStarted, setAlreadyStarted] = useState(false);

  const colonizing = useRef(false);

  function beginColonization () {
    colonizing.current = true;
  }

  function closePopup () {
    setShowCityPopup(false);
  }

  function log (message: string) {
    console.info(message);
  }

  const [finishedInitializing, setFinishedInitializing] = useState(false);

  useEffect(() => {
    if (finishedInitializing) return;

    const heightGenerator = new PERLIN.Generator();
    const heightResults: { [p: string]: number } = {};
    let numHeightResults = 0;

    const moistureGenerator = new PERLIN.Generator();
    const moistureResults: { [p: string]: number } = {};
    let numMoistureResults = 0;

    const temperatureGenerator = new PERLIN.Generator();
    const temperatureResults: { [p: string]: number } = {};
    let numTemperatureResults = 0;

    const squareSize = 110;

    function checkDone () {
      if (numHeightResults >= 4 * squareSize * squareSize && numMoistureResults >= 4 * squareSize * squareSize && numTemperatureResults >= 4 * squareSize * squareSize) {
        for (const key in globe.current.cellMap) {
          const hexPos = parsePosition(key);
          const gridPos = gridToCartesian(hexPos);
          const roundedGridPos = {
            x: Math.round(gridPos.x / 2),
            y: Math.round(gridPos.y / 2)
          };
          const height = heightResults[formatPosition(roundedGridPos)];
          const moisture = moistureResults[formatPosition(roundedGridPos)];
          const inverseTemperature =
            Math.abs(roundedGridPos.y) + 30 * Math.max(0.4, height) * 2 * Math.pow(temperatureResults[formatPosition(roundedGridPos)], 2)

          if (height <= 0.4) {
            if (inverseTemperature > 80) {
              globe.current.cellMap[key].terrain = 'ice';
            } else {
              globe.current.cellMap[key].terrain = 'water';
            }
          }
          else if (height > 0.4 && height <= 0.42) {
            if (inverseTemperature > 80) {
              globe.current.cellMap[key].terrain = 'snow';
            } else {
              globe.current.cellMap[key].terrain = 'sand';
            }
          }
          else if (height > 0.7) {
            globe.current.cellMap[key].terrain = 'mountain';
          } else {
            if (inverseTemperature > 80) {
              globe.current.cellMap[key].terrain = 'snow';
            }
            else if (moisture < 0.35) {
              globe.current.cellMap[key].terrain = 'sand';
            }
            else if (moisture > 0.6) {
              globe.current.cellMap[key].terrain = 'forest';
            }
          }
        }

        setFinishedInitializing(true);
      }
    }
    heightGenerator.generate(
      [-squareSize, -squareSize],
      [2 * squareSize, 2 * squareSize],
      ([x, y]: number[], value: number) => {
        heightResults[`${x}:${y}`] = value;
        numHeightResults += 1;

        checkDone();
      }
    );
    moistureGenerator.generate(
      [-squareSize, -squareSize],
      [2 * squareSize, 2 * squareSize],
      ([x, y]: number[], value: number) => {
        moistureResults[`${x}:${y}`] = value;
        numMoistureResults += 1;

        checkDone();
      }
    );
    temperatureGenerator.generate(
      [-squareSize, -squareSize],
      [2 * squareSize, 2 * squareSize],
      ([x, y]: number[], value: number) => {
        temperatureResults[`${x}:${y}`] = value;
        numTemperatureResults += 1;

        checkDone();
      }
    );
  }, [globe, finishedInitializing]);

  // Probabilistic flood-fill to create a lake in the center

  const globeCanvas = useRef<HTMLCanvasElement>(null);
  const cityCanvas = useRef<HTMLCanvasElement>(null);
  const summaryDisplay = useRef<HTMLDivElement>(null);
  const resourceDisplay = useRef<HTMLDivElement>(null);

  const nextBuilding = useRef<Building | null>(null);
  const destroying = useRef(false);

  function queueDestroy() {
    destroying.current = true;
  }

  function queueTradingPost() {
    nextBuilding.current = new TradingPost();
  }

  function queueExpeditionBase() {
    nextBuilding.current = new ExpeditionBase();
  }

  function queueStorehouse() {
    nextBuilding.current = new Storehouse();
  }

  function queueHouse() {
    nextBuilding.current = new House();
  }

  function queueFishery() {
    nextBuilding.current = new Fishery();
  }

  function queueLoggery() {
    nextBuilding.current = new Loggery();
  }

  function queueFarm() {
    nextBuilding.current = new Farm();
  }

  function queueIrrigatedFarm() {
    nextBuilding.current = new IrrigatedFarm();
  }

  function queueGatheringHut() {
    nextBuilding.current = new GatheringHut();
  }

  useEffect(() => {
    if (!finishedInitializing) return;
    if (alreadyStarted) return;

    setAlreadyStarted(true);

    // Find a good starting hex
    const candidates = globe.current.allBoards.filter((board) =>
      board.allCells.filter((c) => !['mountain', 'water', 'ice', 'snow'].includes(c.terrain)).length > 32
    );

    const initialBoard = candidates[Math.floor(Math.random() * candidates.length)];

    const initialHaven = new Haven();

    const cell = initialBoard.allCells.find((cell) =>
      initialBoard.canPlaceBuilding(initialHaven, cell.position)
    );
    initialBoard.placeBuilding(initialHaven, cell!.position);

    // Start with 2 pops
    initialBoard.pops.push(new Pop(initialBoard));
    initialBoard.pops.push(new Pop(initialBoard));

    board.current = initialBoard;

    console.log('INITIALIZING TICKS');

    let internalDay = 0;

    const globeRenderer = (globeCanvas.current ? new CanvasRenderer(
      globeCanvas.current,
      2
    ) : null);

    const cityRenderer = (cityCanvas.current ? new CanvasRenderer(
      cityCanvas.current,
      20
    ) : null);

    let lastPointer = {x: 0, y: 0};

    function formatInventory (inv: { [g: string]: number }) {
      let result = '';
      for (const key in inv) {
        result += `${key}: ${inv[key]}`; 
      }
      return result;
    }

    function updateResourceDisplay() {
      if (!summaryDisplay.current) return;

      if (board.current) {
        setCurrentPops(board.current.pops.length);
        setCurrentImports(board.current.imports.next);
        setCurrentImports(board.current.imports.next);
        setCurrentProduction(board.current.actualProduction.next);
        const roundedAverage: GoodMap = {};
        for (const key in board.current.nonstorageProduction.average) roundedAverage[key] = Math.round(board.current.nonstorageProduction.average[key]);
        setCurrentAverageProduction(roundedAverage);
        setCurrentSurplus(board.current.surplus.last);
        setCurrentDemand(board.current.demand.next);
        setCurrentPrices(board.current.prices.next);
        /*citySummaryElement.current!.innerText = `
          Day: ${day.current}
          Pops: ${board.current.pops.length}
          Nonstorage production: ${formatInventory(board.current.nonstorageProduction.next)}
          Surplus: ${formatInventory(board.current.surplus.last)}
          Prices: ${formatInventory(board.current.prices.next)}
          Demand: ${formatInventory(board.current.demand.next)}
          Importing: ${formatInventory(board.current.imports.next)}
          Exporting: ${formatInventory(board.current.exports.next)}
        `.trim();*/
      }

      if (!lastPointer) {
        summaryDisplay.current!.innerText = `
          Pops: ${board.current.pops.length}
          Homeless: ${board.current.pops.filter((x: Pop) => !x.home).length}
          Unemployed: ${board.current.pops.filter((x: Pop) => !x.work).length}
          Starving: ${board.current.pops.filter((x: Pop) => !x.fed).length}
        `.trim();
      }
      const {x, y} = lastPointer;
      const cell = board.current.getCell({x, y});

      if (cell?.building) {
        summaryDisplay.current!.innerText = `
          Pops: ${board.current.pops.length}
          Homeless: ${board.current.pops.filter((x: Pop) => !x.home).length}
          Unemployed: ${board.current.pops.filter((x: Pop) => !x.work).length}
          Starving: ${board.current.pops.filter((x: Pop) => !x.fed).length}
        `.trim();

        resourceDisplay.current!.innerText = `
          Cell (${x}, ${y}): ${cell.building.kind}
          Produced: ${formatInventory(cell.building.currentProduction)}
          Storage: ${formatInventory(cell.building.storage)}
          Residents: ${cell.building.residents.length}
        `.trim();
      } else if (cell) {
        summaryDisplay.current!.innerText = `
          Pops: ${board.current.pops.length}
          Homeless: ${board.current.pops.filter((x: Pop) => !x.home).length}
          Unemployed: ${board.current.pops.filter((x: Pop) => !x.work).length}
          Starving: ${board.current.pops.filter((x: Pop) => !x.fed).length}
        `.trim();
        resourceDisplay.current!.innerText = `
          Cell (${x}, ${y})
        `.trim();
      } else {
        summaryDisplay.current!.innerText = `
          Pops: ${board.current.pops.length}
          Homeless: ${board.current.pops.filter((x: Pop) => !x.home).length}
          Unemployed: ${board.current.pops.filter((x: Pop) => !x.work).length}
          Starving: ${board.current.pops.filter((x: Pop) => !x.fed).length}
        `.trim();
      }
    }

    if (cityRenderer && globeRenderer) {
      cityRenderer.on('mousemove', ({x, y}: Coordinate) => {
        lastPointer = {x, y};
        updateResourceDisplay();
          
        if (!nextBuilding.current) return;
        
        cityRenderer.setGhost(nextBuilding.current.shape().map(({x: ox, y: oy}: Coordinate) => ({
          x: x + ox,
          y: y + oy,
        })));
        cityRenderer.ghostColor = (
          board.current.canPlaceBuilding(nextBuilding.current, {x, y}) ?
          'green' :
          'red'
        );
        cityRenderer.clear();
        cityRenderer.renderBoard(board.current);
        cityRenderer.renderGhosts();
      });

      cityRenderer.on('click', ({x, y}: Coordinate) => {
        if (nextBuilding.current && board.current.canPlaceBuilding(nextBuilding.current!, {x, y})) {
          board.current.placeBuilding(nextBuilding.current!, {x, y});
        } else if (destroying.current) {
          const cell = board.current.getCell({x, y});
          if (cell.building) {
            cell.building.destroy();
            destroying.current = false;
          }
        }
        cityRenderer.setGhost([]);
        cityRenderer.clear();
        cityRenderer.renderBoard(board.current);
        cityRenderer.renderGhosts();
        
        globeRenderer.clear();
        globeRenderer.renderGlobe(globe.current, board.current);
        
        nextBuilding.current = null;
      });

      setInterval(() => {
        globe.current.tickOneDay(log);
        cityRenderer.clear();
        cityRenderer.renderBoard(board.current);
        cityRenderer.renderGhosts();

        globeRenderer.clear();
        globeRenderer.renderGlobe(globe.current, board.current);
        updateResourceDisplay();
        internalDay += 1;
        setDay(internalDay);
      }, 1000 / 2);

      document.body.addEventListener('keydown', (e) => {
        if (nextBuilding.current && e.which === 82) {
          nextBuilding.current.rotation = (nextBuilding.current.rotation + 1) % 6;
          
          const {x, y} = lastPointer;
          
          cityRenderer.setGhost(nextBuilding.current!.shape().map(({x: ox, y: oy}: Coordinate) => ({
            x: x + ox,
            y: y + oy,
          })));
          cityRenderer.ghostColor = (
            board.current.canPlaceBuilding(nextBuilding.current!, {x, y}) ?
            'green' :
            'red'
          );
          cityRenderer.clear();
          cityRenderer.renderBoard(board.current);
          cityRenderer.renderGhosts();
        }
      });

      globeRenderer.on('click', ({x, y}: Coordinate) => {
        const newBoard = globe.current.getCell({x, y}).board;
        if (newBoard === board.current) {
          cityRenderer.clear();
          cityRenderer.renderBoard(board.current);
          setShowCityPopup(true);
        } else if (colonizing.current) {
          const pop = board.current.pops.find((pop) => pop.work?.name === 'colonist');
          if (pop) {
            pop.migrate(board.current, newBoard, log);
            const candidates = newBoard.allCells.filter((x) => !['water', 'mountain'].includes(x.terrain));

            if (candidates.length > 0) {
              const spot = candidates[Math.floor(Math.random() * candidates.length)];
              const camp = new Encampment();
              newBoard.placeBuilding(
                camp,
                spot.position
              );

              // Work at the camp
              camp.house(pop);
            }
          }
          colonizing.current = false;
        } else {
          board.current = newBoard;
        }
        globeRenderer.clear();
        globeRenderer.renderGlobe(globe.current, board.current);
      });

      cityRenderer.renderBoard(board.current);
      globeRenderer.renderGlobe(globe.current, board.current);
    }
  }, [finishedInitializing, alreadyStarted]);

  return (
    <div>

      <canvas ref={globeCanvas} width={window.innerWidth - 500} height={window.innerHeight} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        borderRight: '5px solid blue',
        background: 'black'
      }}></canvas>

      <div hidden={!showCityPopup} style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -750 / 2,
        marginTop: -250,
        width: 750,
        height: 500,
        textAlign: 'left',
        border: '5px solid goldenrod',
        zIndex: 999
      }}>
        <canvas ref={cityCanvas} id="city" width={500} height={500} style={{
          position: 'absolute',
          left: 0,
          background: 'black',
        }}></canvas>
        <div style={{
          background: 'beige',
          position: 'absolute',
          top: 0,
          height: '50%',
          right: 0,
          width: 250,
          overflow: 'auto',
        }}>
          <div onClick={queueDestroy} className="building-button"><GiWreckingBall/> Destroy </div>
          <div onClick={queueHouse} className="building-button"><GiHouse/> House </div>
          <div onClick={queueFarm} className="building-button"><GiWheat /> Farm </div>
          <div onClick={queueIrrigatedFarm} className="building-button"><GiPlantWatering /> Irrigated Farm </div>
          <div onClick={queueGatheringHut} className="building-button"><GiStrawberry /> Gathering Hut </div>
          <div onClick={queueFishery} className="building-button"><GiBoatFishing /> Fishery </div>
          <div onClick={queueLoggery} className="building-button"><GiWoodPile /> Loggery </div>
          <div onClick={queueStorehouse} className="building-button"><GiWoodenCrate /> Storehouse </div>
          <div onClick={queueTradingPost} className="building-button"><GiTwoCoins /> Trading Post </div>
          <div onClick={queueExpeditionBase} className="building-button"><GiFlyingFlag /> Expedition Base </div>
        </div>
        <div ref={summaryDisplay} style={{
          position: 'absolute',
          background: 'ivory',
          verticalAlign: 'top',
          bottom: '25%',
          borderBottom: '1px solid black',
          right: 0,
          width: 250,
          height: '25%',
          boxSizing: 'border-box',
          padding: 5,
        }}>Pop summary</div>
        <div ref={resourceDisplay} style={{
          position: 'absolute',
          background: 'ivory',
          verticalAlign: 'top',
          bottom: 0,
          right: 0,
          width: 250,
          height: '25%',
          boxSizing: 'border-box',
          padding: 5,
        }}>Resource display</div>
        <div onClick={closePopup} className="close-button"> <AiOutlineClose /> </div>
      </div>
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 500,
        height: '50%',
        overflow: 'auto',
      }}>
        <div onClick={beginColonization} className="building-button"><GiFlyingFlag/> Colonize </div>
      </div>

      <div ref={logElement} style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 500,
        height: '50%',
        overflow: 'auto',
        borderTop: '1px solid black',
        display: 'none'
      }}>Logs</div>

      <div style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 500,
        height: '50%',
        overflow: 'auto',
        borderTop: '1px solid black'
      }}>
        <div className="display-row">
          Day: {day}
        </div>
        <div className="display-row">
          Pops: {currentPops}
        </div>
        <div className="display-row">
          Imports: <ResourceDisplay value={currentImports}/>
        </div>
        <div className="display-row">
          Production: <ResourceDisplay value={currentProduction}/>
        </div>
        <div className="display-row">
          ANP: <ResourceDisplay value={currentAverageProduction}/>
        </div>
        <div className="display-row">
          Surplus: <ResourceDisplay value={currentSurplus}/>
        </div>
        <div className="display-row">
          Demand: <ResourceDisplay value={currentDemand}/>
        </div>
        <div className="display-row">
          Prices: <ResourceDisplay value={currentPrices}/>
        </div>
        <div className="display-row">
          Exports: <ResourceDisplay value={currentExports}/>
        </div>
      </div>
    </div>
  );
}

export default Game;
