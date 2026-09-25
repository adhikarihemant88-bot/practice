//  submit(job)
//     Accept a job for future execution.
//     job is an object: { id, runAt, fn }
//       - id:    string (unique identifier)
//       - runAt: Date (when the job should run)
//       - fn:    async function () => Promise<void>   (the work to do)
//     submit can be called BEFORE or AFTER start().
//     Jobs submitted before start() are queued and begin processing
//     once start() is called.

//   cancel(jobId)
//     Cancel a scheduled job before it runs.
//     Returns true if cancelled, false otherwise.

//   start()
//     Activate the scheduler. Begin processing all queued and future jobs.

//   stop()
//     Graceful shutdown. Don't process any more jobs. Wait for
//     currently-running jobs to finish, then resolve.
//     Returns a Promise.

class JobScheduler {
    constructor() {
        this.jobs = new Map();
        this.inFlight = new Map();
        this.running = false;
    }

    submit({id, runAt, fn}) {
        const job = { 
            id,
            runAt,
            fn,
            scheduled:false
        };
        this.jobs.set(job.id, job);
        if (this.running) {
            this.scheduleNext();
        }
        return job;
    }

    cancel(jobId) {
        if (this.jobs.has(jobId)) {
            this.jobs.delete(jobId);
            return true;
        }

        return false;
    }

scheduleNext() {
    if (!this.running) {
        return;
    }

    for (const job of this.jobs.values()) {
        if(job.scheduled || this.inFlight.has(job.id)){
            continue;
        }
        const delay = Math.max(0, job.runAt - Date.now());
        job.scheduled = true;
        setTimeout(() => {
            job.scheduled = false;
            void this._flushDueJobs(job);
        }, delay);
    }
}

async _flushDueJobs(job) {
    if (
        !this.running ||
        this.inFlight.has(job.id) ||
        this.jobs.get(job.id) !== job
    ) {
        return;
    }

    let markFinished;
    const completion = new Promise(resolve => {
        markFinished = resolve;
    });

    this.inFlight.set(job.id, completion);

    try {
        for (let attempt = 0; attempt <= 3; attempt++) {
            if (!this.running) {
                break;
            }

            try {
                await job.fn();
                break;
            } catch (error) {
                console.error(
                    `Job ${job.id}, attempt ${attempt + 1} failed:`,
                    error
                );
            }
        }
    } finally {
        if (this.jobs.get(job.id) === job) {
            this.jobs.delete(job.id);
        }

        this.inFlight.delete(job.id);
        markFinished();
    }
}
    start() {
        if (this.running) {
            return;
        }

        this.running = true;
        this.scheduleNext();
    }

    async stop() {
        this.running = false;
         await Promise.allSettled([...this.inFlight]);
    }
}

module.exports = { JobScheduler };
