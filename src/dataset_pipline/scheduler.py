"""
Glacier Pipeline Scheduler
Runs the pipeline automatically at configured intervals.

Usage:
  python scheduler.py               # Run every 24h
  python scheduler.py --interval 6  # Run every 6 hours
  python scheduler.py --once        # Run once and exit
"""

import argparse
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

logger = logging.getLogger("GlacierScheduler")


def run_once(force: bool = False):
    from pipeline import GlacierPipeline
    p = GlacierPipeline()
    return p.run(force_download=force)


def run_scheduler(interval_hours: float = 24.0):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )
    logger.info(f"⏰ Glacier Pipeline Scheduler started (interval: {interval_hours}h)")
    logger.info("   Press Ctrl+C to stop.\n")

    while True:
        next_run = datetime.now(timezone.utc)
        logger.info(f"🚀 Starting scheduled run at {next_run.strftime('%Y-%m-%d %H:%M UTC')}")
        try:
            run_once()
        except Exception as e:
            logger.error(f"Scheduled run failed: {e}")

        sleep_secs = interval_hours * 3600
        next_ts = datetime.now(timezone.utc)
        logger.info(f"💤 Next run in {interval_hours}h (at approx "
                    f"{next_ts.strftime('%Y-%m-%d %H:%M UTC')})\n")
        try:
            time.sleep(sleep_secs)
        except KeyboardInterrupt:
            logger.info("🛑 Scheduler stopped by user.")
            break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Glacier Pipeline Scheduler")
    parser.add_argument("--interval", type=float, default=24.0,
                        help="Run interval in hours (default: 24)")
    parser.add_argument("--once", action="store_true",
                        help="Run once and exit")
    parser.add_argument("--force", action="store_true",
                        help="Force re-download on each run")
    args = parser.parse_args()

    if args.once:
        result = run_once(force=args.force)
        sys.exit(0 if result.get("status") == "success" else 1)
    else:
        run_scheduler(args.interval)
