package singleprogram

import (
	"context"
	"fmt"
	golog "log"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"time"

	embeddedpostgres "github.com/fergusstrange/embedded-postgres"

	"github.com/sourcegraph/log"

	"github.com/sourcegraph/sourcegraph/internal/env"
	"github.com/sourcegraph/sourcegraph/internal/goroutine"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

var useEmbeddedPostgreSQL = env.MustGetBool("USE_EMBEDDED_POSTGRESQL", true, "use an embedded PostgreSQL server (to use an existing PostgreSQL server and database, set the PG* env vars)")

type postgresqlEnvVars struct {
	PGPORT, PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGSSLMODE, PGDATASOURCE string
}

func initPostgreSQL(logger log.Logger, embeddedPostgreSQLRootDir string) error {
	var vars *postgresqlEnvVars
	if useEmbeddedPostgreSQL {
		var err error
		vars, err = startEmbeddedPostgreSQL(embeddedPostgreSQLRootDir)
		if err != nil {
			return errors.Wrap(err, "Failed to download or start embedded postgresql. Please start your own postgres instance then configure the PG* environment variables to connect to it as well as setting USE_EMBEDDED_POSTGRESQL=0")
		}
		os.Setenv("PGPORT", vars.PGPORT)
		os.Setenv("PGHOST", vars.PGHOST)
		os.Setenv("PGUSER", vars.PGUSER)
		os.Setenv("PGPASSWORD", vars.PGPASSWORD)
		os.Setenv("PGDATABASE", vars.PGDATABASE)
		os.Setenv("PGSSLMODE", vars.PGSSLMODE)
		os.Setenv("PGDATASOURCE", vars.PGDATASOURCE)
	} else {
		vars = &postgresqlEnvVars{
			PGPORT:       os.Getenv("PGPORT"),
			PGHOST:       os.Getenv("PGHOST"),
			PGUSER:       os.Getenv("PGUSER"),
			PGPASSWORD:   os.Getenv("PGPASSWORD"),
			PGDATABASE:   os.Getenv("PGDATABASE"),
			PGSSLMODE:    os.Getenv("PGSSLMODE"),
			PGDATASOURCE: os.Getenv("PGDATASOURCE"),
		}
	}

	useSinglePostgreSQLDatabase(logger, vars)

	// Migration on startup is ideal for the single-program deployment because there are no other
	// simultaneously running services at startup that might interfere with a migration.
	//
	// TODO(sqs): TODO(single-binary): make this behavior more official and not just for "dev"
	setDefaultEnv(logger, "SG_DEV_MIGRATE_ON_APPLICATION_STARTUP", "1")

	return nil
}

func startEmbeddedPostgreSQL(pgRootDir string) (*postgresqlEnvVars, error) {
	// Note: some linux distributions (eg NixOS) do not ship with the dynamic
	// linker at the "standard" location which the embedded postgres
	// executables rely on. Give a nice error instead of the confusing "file
	// not found" error.
	//
	// We could consider extending embedded-postgres to use something like
	// patchelf, but this is non-trivial.
	if runtime.GOOS == "linux" && runtime.GOARCH == "amd64" {
		ldso := "/lib64/ld-linux-x86-64.so.2"
		if _, err := os.Stat(ldso); err != nil {
			return nil, errors.Errorf("could not use embedded-postgres since %q is missing", ldso)
		}
	}

	// Note: on macOS unix socket paths must be <103 bytes, so we place them in the home directory.
	current, err := user.Current()
	if err != nil {
		return nil, errors.Wrap(err, "user.Current")
	}
	unixSocketDir := filepath.Join(current.HomeDir, ".sourcegraph-psql")
	err = os.MkdirAll(unixSocketDir, os.ModePerm)
	if err != nil {
		return nil, errors.Wrap(err, "creating unix socket dir")
	}

	vars := &postgresqlEnvVars{
		PGPORT:       "",
		PGHOST:       unixSocketDir,
		PGUSER:       "sourcegraph",
		PGPASSWORD:   "",
		PGDATABASE:   "sourcegraph",
		PGSSLMODE:    "disable",
		PGDATASOURCE: "postgresql:///sourcegraph?host=" + unixSocketDir,
	}

	db := embeddedpostgres.NewDatabase(
		embeddedpostgres.DefaultConfig().
			Version(embeddedpostgres.V14).
			BinariesPath(filepath.Join(pgRootDir, "bin")).
			DataPath(filepath.Join(pgRootDir, "data")).
			RuntimePath(filepath.Join(pgRootDir, "runtime")).
			Username(vars.PGUSER).
			Database(vars.PGDATABASE).
			UseUnixSocket(unixSocketDir).
			Logger(golog.Writer()),
	)
	if err := db.Start(); err != nil {
		return nil, err
	}
	go goroutine.MonitorBackgroundRoutines(context.Background(), &embeddedPostgreSQLBackgroundJob{db})
	return vars, nil
}

type embeddedPostgreSQLBackgroundJob struct {
	db *embeddedpostgres.EmbeddedPostgres // must be already started
}

func (db *embeddedPostgreSQLBackgroundJob) Start() {
	// Noop. We start it synchronously on purpose because everything else following it requires it.
}

func (db *embeddedPostgreSQLBackgroundJob) Stop() {
	// Sleep a short amount of time to give other services time to write to the database during their cleanup.
	time.Sleep(1000 * time.Millisecond)
	if err := db.db.Stop(); err != nil {
		fmt.Fprintln(os.Stderr, "error stopping embedded PostgreSQL:", err)
	}
}

func useSinglePostgreSQLDatabase(logger log.Logger, vars *postgresqlEnvVars) {
	// Use a single PostgreSQL DB.
	//
	// For code intel:
	setDefaultEnv(logger, "CODEINTEL_PGPORT", vars.PGPORT)
	setDefaultEnv(logger, "CODEINTEL_PGHOST", vars.PGHOST)
	setDefaultEnv(logger, "CODEINTEL_PGUSER", vars.PGUSER)
	setDefaultEnv(logger, "CODEINTEL_PGPASSWORD", vars.PGPASSWORD)
	setDefaultEnv(logger, "CODEINTEL_PGDATABASE", vars.PGDATABASE)
	setDefaultEnv(logger, "CODEINTEL_PGSSLMODE", vars.PGSSLMODE)
	setDefaultEnv(logger, "CODEINTEL_PGDATASOURCE", vars.PGDATASOURCE)
	setDefaultEnv(logger, "CODEINTEL_PG_ALLOW_SINGLE_DB", "true")
	// And for code insights.
	setDefaultEnv(logger, "CODEINSIGHTS_PGPORT", vars.PGPORT)
	setDefaultEnv(logger, "CODEINSIGHTS_PGHOST", vars.PGHOST)
	setDefaultEnv(logger, "CODEINSIGHTS_PGUSER", vars.PGUSER)
	setDefaultEnv(logger, "CODEINSIGHTS_PGPASSWORD", vars.PGPASSWORD)
	setDefaultEnv(logger, "CODEINSIGHTS_PGDATABASE", vars.PGDATABASE)
	setDefaultEnv(logger, "CODEINSIGHTS_PGSSLMODE", vars.PGSSLMODE)
	setDefaultEnv(logger, "CODEINSIGHTS_PGDATASOURCE", vars.PGDATASOURCE)
}
