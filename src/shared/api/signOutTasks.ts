type SignOutTask = () => Promise<unknown> | unknown;

const tasks = new Set<SignOutTask>();

export function registerSignOutTask(task: SignOutTask): () => void {
  tasks.add(task);
  return () => tasks.delete(task);
}

export async function runSignOutTasks(timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const work = Promise.allSettled(
    [...tasks].map((task) => Promise.resolve().then(task)),
  );
  try {
    await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
