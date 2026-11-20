// Package pool runs independent jobs.
package pool

import "sync"

// Job is one unit of work.
type Job struct {
	ID   int
	Data string
}

// Run processes every job concurrently and returns each result by job id.
func Run(jobs []Job, process func(Job) string) map[int]string {
	results := make(map[int]string, len(jobs))
	var wg sync.WaitGroup
	for _, job := range jobs {
		go func() {
			wg.Add(1)
			defer wg.Done()
			results[job.ID] = process(job)
		}()
	}
	wg.Wait()
	return results
}
