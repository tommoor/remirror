import PromiseWorker from 'promise-worker';

export class TypedPromiseWorker<Output, Input> extends PromiseWorker {
  /**
   * Send the data to the worker and receive the response back.
   */
  async send(input: Input): Promise<Output> {
    return super.postMessage<Output, Input>(input);
  }
}

/**
 * Run low-priority and non critical work during an idle moment. Supports
 * scheduling one task at a time.
 */
export class IdleScheduler {
  task?: number;

  request(): Promise<void> {
    // Clear all scheduled idle tasks.
    this.cancel();

    // `requestIdleCallback` is currently not supported on safari.
    const request = window.requestIdleCallback ?? window.requestAnimationFrame;

    return new Promise((resolve) => {
      this.task = request(() => resolve());
    });
  }

  // Cancel the scheduled task.
  cancel(): void {
    const cancel = window.cancelIdleCallback || window.cancelAnimationFrame;

    if (this.task) {
      cancel(this.task);
    }
  }
}
