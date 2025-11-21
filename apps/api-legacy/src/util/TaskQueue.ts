export interface ITask<T> {
  (): Promise<T>;
}

export class TaskQueue<T> {
  private concurrency: number;
  private running: number;
  private queue: ITask<T>[];

  constructor(concurrency: number) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  public pushTask(task: ITask<T>): void {
    this.queue.push(task);
    this.next();
  }

  private next(): void {
    while (this.running < this.concurrency && this.queue.length) {
      const task = this.queue.shift()!;
      task().then(() => {
        this.running--;
        this.next();
      });
      this.running++;
    }
  }
}

export default TaskQueue;
