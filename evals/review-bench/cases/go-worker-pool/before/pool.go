// Package pool runs independent jobs.
package pool

// Job is one unit of work.
type Job struct {
	ID   int
	Data string
}
