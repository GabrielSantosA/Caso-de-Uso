export class Graph {
  private adjacencyList: Map<string, string[]>;

  constructor() {
    this.adjacencyList = new Map();
  }

  addNode(node: string): void {
    if (!this.adjacencyList.has(node)) {
      this.adjacencyList.set(node, []);
    }
  }

  addEdge(source: string, destination: string): void {
    if (!this.adjacencyList.has(source))
      throw new Error(`Source node ${source} not found`);
    if (!this.adjacencyList.has(destination))
      throw new Error(`Destination node ${destination} not found`);
    this.adjacencyList.get(source)?.push(destination);
  }

  getNodes(): IterableIterator<string> {
    return this.adjacencyList.keys();
  }

  getNeighbors(node: string): string[] | undefined {
    return this.adjacencyList.get(node);
  }

  hasCycle(): string[] | null {
    const visited: Set<string> = new Set();
    const recursionStack: Set<string> = new Set();

    for (const node of this.adjacencyList.keys()) {
      const cycle = this.detectCycleUtil(node, visited, recursionStack);
      if (cycle) {
        return cycle;
      }
    }
    return null;
  }

  private detectCycleUtil(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): string[] | null {
    if (recursionStack.has(node)) {
      const cycleStartIndex = Array.from(recursionStack).indexOf(node);
      const cycle = Array.from(recursionStack).slice(cycleStartIndex);
      cycle.push(node);
      return cycle;
    }
    if (visited.has(node)) {
      return null;
    }

    visited.add(node);
    recursionStack.add(node);

    const neighbors = this.adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      const cycle = this.detectCycleUtil(neighbor, visited, recursionStack);
      if (cycle) {
        return cycle;
      }
    }

    recursionStack.delete(node);
    return null;
  }
}
