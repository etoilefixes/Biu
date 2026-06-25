declare module 'node-cron' {
  interface ScheduledTask {
    start: () => void;
    stop: () => void;
  }

  function schedule(
    expression: string,
    callback: (now: Date | 'manual' | 'init') => void,
    options?: Record<string, unknown>,
  ): ScheduledTask;

  function validate(expression: string): boolean;

  export { schedule, validate, type ScheduledTask };
}
