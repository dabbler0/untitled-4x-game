import { Coordinate, plus, formatPosition } from './Coordinate';

type LogFunction = (m: string) => void;

type TexturedCoordinate = {
  x: number;
  y: number;
  t?: string;
}

export class Cell {
  position: Coordinate;
  terrain: string;
  board: Board;
  building: Building | null;
  buildingTexture: string | null;

  constructor (position: Coordinate, terrain: string, board: Board) {
    this.position = position;
    this.building = null;
    this.terrain = terrain;
    this.board = board;
    this.buildingTexture = null;
  }
}

export function adjacents ({x, y}: Coordinate) {
  return [
    { x: x + 1, y: y },
    { x: x - 1, y: y },
    { x: x, y: y + 1 },
    { x: x, y: y - 1 },
    { x: x - 1, y: y + 1 },
    { x: x + 1, y: y - 1 }
  ];
}

function hexDistance({x: x1, y: y1}: Coordinate, {x: x2, y: y2}: Coordinate) {
  const dx = x1 - x2, dy = y1 - y2;
  if (dx > 0 === dy > 0) return Math.abs(dx + dy);
  else return Math.max(Math.abs(dx), Math.abs(dy));
}

function rotateOffset ({x, y, t}: TexturedCoordinate, r: number) {
  switch (r % 6) {
    case 0:
      return {x, y, t};
    case 1:
      return {x: -y, y: x + y, t};
    case 2:
      return {x: -x - y, y: x, t};
    case 3:
      return {x: -x, y: -y, t};
    case 4:
      return {x: y, y: -x - y, t};
    case 5:
      return {x: x + y, y: -x, t};
    default: // Should never occur
      return {x, y, t};
  }
}

export class PrioritizedHandler {
  priority: number;
  handler: (l: LogFunction) => void;

  constructor (priority: number, handler: (l: LogFunction) => void) {
    this.priority = priority;
    this.handler = handler;
  }
}

export class Pop {
  board: Board | null;
  home: Building | null;
  work: Job | null;
  fed: boolean;
  stats: {
    int: number, wis: number, con: number, str: number, dex: number, cha: number
  };
  id: string;

  constructor (board: Board) {
    this.board = board;
    this.stats = {
      'int': 8,
      'wis': 8,
      'con': 8,
      'str': 8,
      'dex': 8,
      'cha': 8
    };

    this.home = null;
    this.work = null;
    this.fed = false;
    this.id = Math.random().toString(16);
  }
  
  tickAdmin (board: Board, log: LogFunction) {
    return;
  }

  migrate (board: Board, dest: Board, log: LogFunction) {
    if (!this.work ||
      !this.board ||
      this.work!.name !== 'colonist' ||
      !('food' in this.work!.building!.storage) ||
      this.work!.building!.storage['food'] < 1000
    ) return;

    // Unlink from current board
    this.board!.pops.splice(
      this.board!.pops.indexOf(this), 1
    );

    // Unlink from current job
    this.work.building.destroy();

    // Unlink from current home
    if (this.home) {
      this.home.residents.splice(
        this.home.residents.indexOf(this), 1
      );
    }

    // Move to new board
    this.board = dest;
    this.board.pops.push(this);

    console.log('Successfully migrated!');
  }

  checkGrowth (board: Board, log: LogFunction) {
    // Possibly grow
    if (this.home && this.fed) {
      if (Math.random() < 0.1) {
        // Growth costs extra food and extra housing
        const freeHouse = board.buildings.find((building) => building.residents.length < building.housingCapacity);
        if (!freeHouse) return;

        if (board.consumeOrFail('food', 80 / this.stats.con)) {
          const newPop = new Pop(board);
          log(`${this.id} birthed ${newPop.id}`);
          board.pops.push(
            newPop
          );
        }
      }
    }
  }

  checkMetabolism (board: Board, log: LogFunction) {
    // If on an empty board, create an encampment
    if (board.buildings.length === 0) {
    }

    // Try to find a home
    if (this.home === null) {
      for (const building of board.buildings) {
        if (building.house(this)) {
          log(`${this.id} moved into a house`);
          break;
        }
      }
    }

    // Try to find work
    if (this.work === null) {
      for (const job of board.buildings.flatMap((building) => building.jobs)) {
        if (job.employ(this)) {
          log(`${this.id} began working as a ${job.name}`);
          break;
        }
      }
    }

    // Eat
    board.incrementDemand('food', 80 / this.stats.con);

    const { amount } =
      board.consume('food', 80 / this.stats.con);

    if (amount === 80 / this.stats.con) {
      this.fed = true;
    } else {
      this.fed = false;
    }

    // Possibly die
    if (!this.fed) {
      if (Math.random() < 0.1) {
        log(`${this.id} died of starvation`);
        this.die();
      }
    }

    if (!this.home) {
      if (Math.random() < 0.1) {
        log(`${this.id} died of exposure`);
        this.die();
      }
    }
  }

  die () {
    // Remove from board, home, job
    if (this.board) {
      this.board.pops.splice(
        this.board.pops.indexOf(this), 1
      );
    }
    if (this.home) {
      this.home.residents.splice(
        this.home.residents.indexOf(this), 1
      );
    }
    if (this.work) {
      this.work.empty();
    }
  }

  tickHandlers (board: Board) {
    const result = [
      // Every turn, eat and look for housing
      new PrioritizedHandler(
        // Housed working people have privilege
        this.home && this.work ? 0 :
        this.home ? 1
        : 2,
        (log: LogFunction) => this.checkMetabolism(board, log)
      ),
      new PrioritizedHandler(
        // Housed working people have privilege
        16,
        (log: LogFunction) => this.checkGrowth(board, log)
      ),
    // Then, try to do own job
    ];
    if (this.fed && this.home && this.work) {
      return result.concat(this.work.tickHandlers(this, board));
    }
    return result;
  }
}

export class Job {
  building: Building;
  worker: Pop | null;
  name: string;

  constructor (building: Building) {
    this.building = building;
    this.worker = null;
    this.name = 'job';
  }

  employ (pop: Pop) {
    if (this.worker) return false;

    pop.work = this;
    this.worker = pop;
    return true;
  }

  empty () {
    if (this.worker)
      this.worker!.work = null;
    this.worker = null;
  }

  tickHandlers (pop: Pop, board: Board): PrioritizedHandler[] {
    return [];
  }
}

export class Building {
  kind: string;
  inventorySize: { [g: string]: number };
  housingCapacity: number;
  baseShape: TexturedCoordinate[];
  residents: Pop[];
  jobs: Job[];
  rotation: number;
  position: Coordinate | null;
  board: Board | null;
  storage: { [g: string]: number };
  currentProduction: { [g: string]: number };

  // Shape is an array of offsets
  constructor () {
    this.kind = 'basic';
    this.inventorySize = {};
    this.housingCapacity = 0;
    this.baseShape = [{x: 0, y: 0}];
    this.jobs = [];
    
    this.rotation = 0;
    this.position = null; // initially null
    this.board = null; // initially null

    // For display purposes
    this.currentProduction = {};
    
    // Surplus _this round_.
    this.storage = {};
    this.residents = [];
  }

  destroy () {
    if (!this.board) return;

    // Remove from board building list
    this.board.buildings.splice(
      this.board.buildings.indexOf(this), 1
    );
    // Remove from cells
    this.board.allCells.forEach((cell) => {
      if (cell.building === this) {
        cell.building = null;
        cell.buildingTexture = null;
      }
    });
    // No more board or position
    this.position = null;
    this.board = null;

    // Empty all jobs
    this.jobs.forEach((job) => job.empty());

    this.residents.forEach((pop) => {
      pop.home = null;
    });
  }
  
  produce (resource: string, amount: number, storage = false) {
    if (!(resource in this.currentProduction)) this.currentProduction[resource] = 0;
    this.currentProduction[resource] += amount;
    this.board?.produce(resource, amount, storage);
  }

  getStorage (resource: string) {
    return (resource in this.storage ? this.storage[resource] : 0);
  }

  store (resource: string, amount: number) {
    if (!(resource in this.inventorySize)) return 0;
    if (!(resource in this.storage)) this.storage[resource] = 0;
    const storedAmount = Math.min(this.inventorySize[resource] - this.storage[resource], amount);
    this.storage[resource] += storedAmount;
    return storedAmount;
  }

  retrieve (resource: string, amount: number) {
    if (!(resource in this.storage)) return 0;
    const retreivedAmount = Math.min(this.storage[resource], amount);
    this.storage[resource] -= retreivedAmount;
    return retreivedAmount;
  }

  house (pop: Pop) {
    if (this.residents.length < this.housingCapacity) {
      this.residents.push(pop);
      pop.home = this;
      return true;
    }
    else {
      return false;
    }
  }

  canPlaceOn (cells: Cell[]) {
    return cells.every((x) => !['water', 'mountain'].includes(x.terrain));
  }

  tickAdmin (board: Board, log: LogFunction) {
    this.currentProduction = {};
    return;
  }

  tickHandlers (board: Board): PrioritizedHandler[] {
    return [];
  }
  
  shape (): TexturedCoordinate[] {
    return this.baseShape.map((p) => rotateOffset(
      p,
      this.rotation
    ));
  }
  
  occupiedPositions () {
    if (!this.position) return [];
    return this.shape().map(({x, y}) => ({
      x: this.position!.x + x,
      y: this.position!.y + y,
    }));
  }
}

export type GoodMap = {
  [g: string]: number;
}

class TurnoverMap {
  last: GoodMap;
  next: GoodMap;
  average: GoodMap;
  keepAverage: boolean;

  constructor (keepAverage = false) {
    this.last = {};
    this.next = {};
    this.average = {};
    this.keepAverage = keepAverage;
  }

  turnover () {
    if (this.keepAverage) {
      for (const key in this.next) {
        if (!(key in this.average)) this.average[key] = 0;
        this.average[key] = 0.9 * this.average[key] + 0.1 * this.next[key];
      }
      for (const key in this.average) {
        if (!(key in this.next)) {
          this.average[key] = 0.9 * this.average[key];
        }
      }
    }
    this.last = this.next;
    this.next = {};
  }

  incrementNext (g: string, n: number) {
    if (!(g in this.next)) this.next[g] = 0;
    this.next[g] += n;
  }

  get (g: string) {
    if (g in this.last) {
      return this.last[g];
    }
    return 0;
  }

  getAverage (g: string) {
    if (g in this.average) {
      return this.average[g];
    }
    return 0;
  }

  decrementLast (g: string, n: number) {
    if (g in this.last) {
      const available = this.last[g];
      const amount = Math.min(n, available);
      this.last[g] -= amount;
      return { amount, available }
    } else {
      return { amount: 0, available: 0 };
    }
  }

  decrementLastOrFail (g: string, n: number) {
    if (g in this.last && this.last[g] >= n) {
      this.last[g] -= n;
      return true;
    } else {
      return false;
    }
  }
}

export class Board {
  position: Coordinate;
  allCells: Cell[];
  cellMap: { [f: string]: Cell };
  buildings: Building[];
  pops: Pop[];
  radius: number;
  globe: Globe;

  surplus: TurnoverMap;
  exports: TurnoverMap;
  imports: TurnoverMap;
  prices: TurnoverMap;
  demand: TurnoverMap;
  nonstorageProduction: TurnoverMap;
  actualProduction: TurnoverMap;
  localPrices: GoodMap;

  turnoverMaps: TurnoverMap[];

  constructor (radius: number, globe: Globe, globalPosition: Coordinate) {
    this.position = globalPosition;
    this.globe = globe;
    this.radius = radius;
    
    this.allCells = [];
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        if (Math.abs(i + j) <= radius){
          this.allCells.push(new Cell({
            x: i, y: j,
          }, 'grass', this));
        }
      }
    }
    this.cellMap = {};
    this.allCells.forEach((cell) => {
      this.cellMap[formatPosition(cell.position)] = cell;
    });
    this.buildings = [];
    this.pops = [];

    this.localPrices = {};

    this.exports = new TurnoverMap();
    this.imports = new TurnoverMap();
    this.prices = new TurnoverMap();
    this.surplus = new TurnoverMap();
    this.nonstorageProduction = new TurnoverMap(true);
    this.actualProduction = new TurnoverMap();
    this.demand = new TurnoverMap();

    this.turnoverMaps = [
      this.exports,
      this.imports,
      this.surplus,
      this.prices,
      this.nonstorageProduction,
      this.actualProduction,
      this.demand,
    ];
  }

  consume (good: string, maxAmount: number) {
    return this.surplus.decrementLast(good, maxAmount);
  }

  export (good: string, maxAmount: number) {
    const { amount, available } = this.consume(good, maxAmount);
    this.exports.incrementNext(good, amount);
    return { amount, available };
  }

  consumeOrFail (good: string, maxAmount: number) {
    return this.surplus.decrementLastOrFail(good, maxAmount);
  }

  produce (good: string, amount: number, storage = false, isImport = false) {
    this.surplus.incrementNext(good, amount);
    if (!storage) {
      this.nonstorageProduction.incrementNext(good, amount);
    }
    if (!storage && !isImport) {
      this.actualProduction.incrementNext(good, amount);
    }
  }

  incrementDemand (good: string, amount: number) {
    this.demand.incrementNext(good, amount);
  }

  import (good: string, amount: number) {
    this.produce(good, amount, false, true);
    this.imports.incrementNext(good, amount);
  }

  setPriceToAtLeast (good: string, price: number) {
    if (!(good in this.prices.next)) {
      this.prices.next[good] = price;
    } else {
      this.prices.next[good] = Math.max(this.prices.next[good], price);
    }
  }
  
  tickOneDay (log: LogFunction) {
    // Turn over resources
    this.turnoverMaps.forEach((map: TurnoverMap) => map.turnover());

    // Turn over a new day
    this.pops.forEach((pop) => {
      pop.tickAdmin(this, log);
    });
    this.buildings.forEach((building) => {
      building.tickAdmin(this, log);
    });

    // Everyone does some work
    this.buildings
      .flatMap((building) => building.tickHandlers(this))
      .sort((a, b) => a.priority - b.priority)
      .forEach(({ handler }) => handler(log));

    this.pops
      .flatMap((pop) => pop.tickHandlers(this))
      .sort((a, b) => a.priority - b.priority)
      .forEach(({ handler }) => handler(log));
  }
  
  getCell ({x, y}: Coordinate) {
    return this.cellMap[formatPosition({x, y})];
  }
  
  placeBuilding (building: Building, {x, y}: Coordinate) {
    this.buildings.push(building);
    building.position = {x, y};
    building.board = this;
    building.shape().forEach(({x: ox, y: oy, t}: TexturedCoordinate) => {
      const cell = this.getCell({x: x + ox, y: y + oy});
      cell.building = building;
      cell.buildingTexture = t || null;
    });
  }
  
  canPlaceBuilding (building: Building, {x, y}: Coordinate) {
    const cells = building.shape().map(({x: ox, y: oy}: Coordinate) => {
      const cell = this.getCell({x: x + ox, y: y + oy});
      return cell;
    });
    return cells.every((cell) => cell && !cell.building) && building.canPlaceOn(cells);
  }
}

export class Globe {
  cellMap: { [f: string]: Cell };
  allCells: Cell[];

  boardMap: { [f: string]: Board };
  allBoards: Board[];

  boardRadius: number;

  constructor (radius: number, boardRadius: number) {
    this.boardRadius = boardRadius;

    // All boards
    this.allBoards = [];
    this.allCells = [];
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        if (Math.abs(i + j) <= radius){
          const board = new Board(boardRadius, this, {
            x: i, y: j,
          });
          this.allBoards.push(board);
          board.allCells.forEach((cell) => this.allCells.push(cell));
        }
      }
    }
    this.boardMap = {};
    this.cellMap = {};
    this.allBoards.forEach((board) => {
      this.boardMap[formatPosition(board.position)] = board;
      board.allCells.forEach((cell) => {
        const dest = plus(this.boardCenter(board.position), cell.position);
        this.cellMap[formatPosition(dest)] = cell;
      });
    });
  }

  boardCenter ({x, y}: Coordinate) {
    const offset = this.boardRadius + 1;
    return {
      x: offset * x - (offset - 1) * y,
      y: (offset - 1) * x + (2 * offset - 1) * y
    }
  }
  
  tickOneDay (log: LogFunction) {
    this.allBoards.forEach((board) => board.tickOneDay(log));
  }
  
  getBoard ({x, y}: Coordinate) {
    return this.boardMap[formatPosition({x, y})];
  }

  getCell ({x, y}: Coordinate) {
    return this.cellMap[formatPosition({x, y})];
  }
}
