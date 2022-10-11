import { Building, Job, Pop, Board, PrioritizedHandler, Cell, adjacents } from './Model';

export class Encampment extends Building {
  constructor () {
    super();
    this.kind = 'encampment';
    this.housingCapacity = 2;
    this.baseShape = [{x: 0, y: 0, t: 'encampment'}];
    this.jobs = []
    this.inventorySize = { 'food': 1000 };
    this.store('food', 1000);
    this.produce('food', 20);
  }

  tickHandlers (board: Board) {
    return [
      new PrioritizedHandler(
        0,
        () => {
          this.produce('food', this.retrieve('food', 20), true);
        }
      )
    ];
  }
}


export class Haven extends Building {
  constructor () {
    super();
    this.kind = 'haven';
    this.baseShape = [
      { x: 0, y: 0, t: 'haven' },
      { x: 0, y: 1, t: 'haven' },
      { x: 0, y: -1, t: 'haven' },
      { x: 1, y: 0, t: 'haven' },
      { x: -1, y: 0, t: 'haven' },
      { x: 1, y: -1, t: 'haven' },
      { x: -1, y: 1, t: 'haven' }
    ];
    this.housingCapacity = 5;
  }

  tickHandlers (board: Board) {
    return [
      new PrioritizedHandler(
        3,
        () => {
          board.produce('food', 20);
          board.produce('wood', 10);
          board.produce('stone', 10);
        }
      )
    ];
  }
}

export class House extends Building {
  constructor () {
    super();
    this.kind = 'house';
    this.baseShape = [
      { x: 0, y: 0, t: 'house' }
    ];
    this.inventorySize = { 'food': 20 };
    this.housingCapacity = 5;
  }
}

export class Lumberjack extends Job {
  constructor (building: Building) {
    super(building);
    this.name = 'lumberjack';
  }

  tickHandlers (pop: Pop, board: Board) {
    return [
      new PrioritizedHandler(
        1,
        () => {
          this.building.produce('wood', pop.stats.str * 2);
        }
      )
    ]
  }
}

export class Loggery extends Building {
  constructor () {
    super();
    this.kind = 'loggery';
    this.baseShape = [
      {x: 0, y: 0, t: 'loggery'},
      {x: 0, y: 1, t: 'loggery'},
      {x: 1, y: 0, t: 'loggery'}
    ];
    this.jobs = [ new Lumberjack(this) ];
  }

  canPlaceOn (cells: Cell[]) {
    return cells.some((x) => x.terrain === 'forest');
  }
}

export class Fisher extends Job {
  constructor (building: Building) {
    super(building);
    this.name = 'fisher';
  }

  tickHandlers (pop: Pop, board: Board) {
    return [
      new PrioritizedHandler(
        1,
        () => {
          this.building.produce('food', pop.stats.str * 2);
        }
      )
    ]
  }
}

export class Fishery extends Building {
  constructor () {
    super();
    this.kind = 'fishery';
    this.baseShape = [
      {x: 0, y: 0, t: 'fishery'},
      {x: 0, y: 1, t: 'fishery'},
      {x: 0, y: 2 },
      {x: -1, y: 2 },
      {x: 1, y: 1 }
    ];
    this.jobs = [ new Fisher(this) ];
  }

  canPlaceOn (cells: Cell[]) {
    return cells.length > 0 && !['mountain', 'water'].includes(cells[0].terrain) &&
           cells.every((x, i) => i === 0 || x.terrain === 'water');
  }
}

export class Farmer extends Job {
  constructor (building: Building) {
    super(building);
    this.name = 'farmer';
  }

  tickHandlers (pop: Pop, board: Board) {
    return [
      new PrioritizedHandler(
        1,
        () => {
          this.building.produce('food', pop.stats.str * 2);
        }
      )
    ]
  }
}

export class Farm extends Building {
  constructor () {
    super();
    this.kind = 'farm';
    this.baseShape = [
      {x: 0, y: 0, t: 'farm'},
      {x: 0, y: 1, t: 'farm'},
      {x: 1, y: 0, t: 'farm'},
      {x: 1, y: 1, t: 'farm'},
    ];
    this.jobs = [ new Farmer(this) ];
  }

  canPlaceOn (cells: Cell[]) {
    return cells.every((cell) => ['grass'].includes(cell.terrain));
  }
}

export class IrrigatedFarm extends Building {
  constructor () {
    super();
    this.kind = 'irrigatedFarm';
    this.baseShape = [
      {x: 0, y: 0, t: 'qanat'},
      {x: 0, y: -1, t: 'irrigatedFarm'},
      {x: -1, y: 0, t: 'irrigatedFarm'},
      {x: 0, y: 1, t: 'irrigatedFarm'},
      {x: 1, y: 0, t: 'irrigatedFarm'},
      {x: 1, y: -1, t: 'irrigatedFarm'},
      {x: -1, y: 1, t: 'irrigatedFarm'},
    ];
    this.jobs = [ new Farmer(this) ];
  }

  canPlaceOn (cells: Cell[]) {
    return cells.every((cell) => ['grass', 'sand'].includes(cell.terrain));
  }
}

export class GatheringHut extends Building {
  constructor () {
    super();
    this.kind = 'gatheringHut';
    this.baseShape = [
      {x: 0, y: 0, t: 'gatheringHut'},
      {x: 0, y: -1, },
      {x: -1, y: 0, },
      {x: 0, y: 1, },
      {x: 1, y: 0, },
      {x: 1, y: -1, },
      {x: -1, y: 1, },
    ];
    this.jobs = [ new Farmer(this) ];
  }

  canPlaceOn (cells: Cell[]) {
    return cells.every((cell) => ['grass', 'forest'].includes(cell.terrain));
  }
}

export class Palace extends Building {
  constructor () {
    super();
    this.kind = 'palace';
    this.baseShape = [
      {x: 0, y: 0},
      {x: 1, y: 0},
      {x: 1, y: -1},
      {x: -1, y: 0},
      {x: -1, y: 1},
      {x: 0, y: 1},
      {x: 0, y: -1},
    ];
    this.housingCapacity = 20;
  }

  tickHandlers (board: Board) {
    return [
      new PrioritizedHandler(
        3,
        () => {
          this.produce('food', 10)
        }
      )
    ];
  }
}

export class Warehouser extends Job {
  constructor (building: Building) {
    super(building);
    this.name = 'warehouser';
  }

  tickHandlers (pop: Pop, board: Board) {
    return [
      new PrioritizedHandler(
        10,
        () => {
          // Produce half
          const maxProduced = pop.stats.str * 5;

          this.building.produce(
            'food',
            this.building.retrieve('food', maxProduced),
            true
          );

          // Consume whole
          const maxConsumed = Math.min(
            pop.stats.str * 10,
            this.building.inventorySize['food'] - this.building.getStorage('food')
          )

          // For now visit ALL buildings,
          // but in the future we can limit to "nearby" buildings
          const { amount, available } = board.consume('food', maxConsumed);

          this.building.store('food', amount);
        }
      )
    ]
  }
}

export class Trader extends Job {
  constructor (building: Building) {
    super(building);
    this.name = 'trader';
  }

  tickHandlers (pop: Pop, ownBoard: Board) {
    return [
      new PrioritizedHandler(
        9,
        () => {
          // A trader always demands some buffer food
          ownBoard.incrementDemand('food', 10);

          // Get adjacent boards
          const adjacentBoards = adjacents(ownBoard.position)
            .map((p) => ownBoard.globe.getBoard(p)).filter((x) => x);

          // Fetch and update prices
          const bestPrices: { [g: string]: number } = {};
          adjacentBoards.forEach((board) => {
            for (const key in board.prices.last) {
              if (key in bestPrices) {
                bestPrices[key] = Math.max(bestPrices[key], board.prices.last[key]);
              } else {
                bestPrices[key] = board.prices.last[key];
              }
            }
          });

          for (const key in bestPrices) {
            ownBoard.setPriceToAtLeast(key, Math.max(0, bestPrices[key] - 1));
          }

          // Amp prices to match demand
          for (const key in ownBoard.demand.last) {
            const production = ownBoard.nonstorageProduction.getAverage(key);
            const lastProduction = ownBoard.nonstorageProduction.get(key);
            if (!(key in ownBoard.localPrices)) ownBoard.localPrices[key] = 0;

            if (ownBoard.demand.last[key] > production && ownBoard.demand.last[key] > lastProduction) {
              if (!(key in ownBoard.localPrices)) ownBoard.localPrices[key] = 1;
              ownBoard.localPrices[key] += 1;
            }
            else if (ownBoard.demand.last[key] < production * 0.6) {
              ownBoard.localPrices[key] = Math.max(ownBoard.localPrices[key] - 1, 0);
            }
          }

          for (const key in ownBoard.localPrices) {
            ownBoard.setPriceToAtLeast(key, ownBoard.localPrices[key]);
          }

          // Make purchases in profit order
          const purchases = adjacentBoards.flatMap((board) => 
            Object.keys(board.prices.last).map((good) => ({
              board,
              good,
              profit: ownBoard.prices.get(good) - board.prices.last[good]
            }))
          );

          let totalCapacity = pop.stats.str * pop.stats.cha * 5;

          purchases.sort((a, b) => b.profit - a.profit).forEach((purchase) => {
            if (purchase.profit > 0) {
              const { amount } = purchase.board.export(purchase.good, totalCapacity);
              ownBoard.import(purchase.good, amount);
              totalCapacity -= amount;
            }
          });
        }
      )
    ];
  }
}

export class TradingPost extends Building {
  constructor () {
    super();
    this.kind = 'tradingPost';
    this.baseShape = [
      {x: 0, y: 0, t: 'tradingPost'},
      {x: 0, y: 1, t: 'tradingPost'}
    ];
    this.jobs = [ new Trader(this) ];
  }
}

export class Storehouse extends Building {
  constructor () {
    super();
    this.kind = 'storehouse';
    this.baseShape = [
      {x: 0, y: 0, t: 'storehouse'},
      {x: 0, y: 1, t: 'storehouse'}
    ];
    this.inventorySize = {
      food: 1000,
    };
    this.jobs = [ new Warehouser(this) ];
  }
}

export class Colonist extends Job {
  constructor (building: Building) {
    super(building);
    this.name = 'colonist';
  }

  tickHandlers (pop: Pop, board: Board) {
    return [
      new PrioritizedHandler(
        9,
        () => {
          const maxConsumed = Math.min(
            pop.stats.str * 10,
            this.building.inventorySize['food'] - this.building.getStorage('food')
          )

          const { amount } = board.consume('food', maxConsumed);
          this.building.store('food', amount);
        }
      )
    ]
  }
}

export class ExpeditionBase extends Building {
  constructor () {
    super();
    this.kind = 'expeditionBase';
    this.baseShape = [
      {x: 0, y: 0, t: 'expeditionBase' },
    ];
    this.inventorySize = {
      food: 1000,
    };
    this.jobs = [ new Colonist(this) ];
  }

}

