from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
SERVER_FILE = Path(__file__).with_name("server.py")

# Pilihan: "pull", "push", atau "none"
GIT_TASK = "pull"


def git(*args, check=True):
    return subprocess.run(["git", *args], cwd=ROOT, check=check)


def run_git_task():
    task = GIT_TASK.lower()

    if task == "none":
        print("Tugas Git dilewati.")
        return

    if task == "pull":
        print("=== KB: PULL ===")
        git("pull")
        return

    if task == "push":
        print("=== KB: PUSH ===")
        git("add", "-A")
        result = git("diff", "--cached", "--quiet", check=False)

        if result.returncode == 1:
            git("commit", "-m", "Update KB")
        elif result.returncode != 0:
            raise subprocess.CalledProcessError(result.returncode, "git diff --cached --quiet")
        else:
            print("Tidak ada perubahan baru untuk di-commit.")

        git("push")
        return

    raise ValueError(f"GIT_TASK tidak dikenal: {GIT_TASK}")


def main():
    try:
        run_git_task()
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError) as exc:
        print(f"\nProses Git gagal: {exc}")
        return 1

    print("\n=== MENJALANKAN KONTEN BUILDER ===")
    return subprocess.call([sys.executable, str(SERVER_FILE)], cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
