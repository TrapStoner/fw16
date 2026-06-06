# 💤 Hibernate Setup Guide — Framework 16 AMD (Fedora)

**Tested on:** Framework Laptop 16 · AMD Ryzen 9 7940HS (7040 Series) · AMD RZ616 WiFi  
**Tested with:** Fedora 44 · KDE Plasma 6 · Wayland · btrfs root · kernel 7.0.x  
**Applies to:** Fedora 40+ on Framework 16 AMD (and likely other AMD btrfs Fedora laptops)

!!! danger "Before you begin"
This guide requires **Secure Boot disabled** and a **non-encrypted (no LUKS) filesystem**. If either applies to you, additional steps are needed that are not covered here. If you know what you're doing, you can disable Secure Boot in your BIOS — but be aware it removes firmware-level verification of your bootloader and kernel, weakening protection against bootkits and unsigned code. I am not responsible for any consequences. With that out of the way — enjoy!

!!! note "Desktop environment"
This guide is written for and tested on KDE Plasma on Wayland. Steps involving power management settings reference KDE System Settings. If you use GNOME, sway, or another DE/WM, all kernel and system steps are identical — only the DE-specific power management configuration differs. Look up the equivalent settings for your environment.

---

## Background: why hibernate needs special setup on fedora

Fedora uses a btrfs root filesystem and zram as its primary swap device by default. Hibernate (suspend-to-disk / S4) requires writing the entire contents of RAM to a swap device on disk — zram is RAM-backed and therefore unsuitable. You need a real swapfile on disk.

Btrfs swapfiles have a physical offset into the filesystem that the kernel must know about at boot time. Unlike swap partitions where the device address is the resume target directly, btrfs files are not laid out contiguously on disk and the kernel needs both the device UUID and the file's first physical extent offset.

Fedora also enforces SELinux, which by default denies systemd-logind and systemd-sleep the permissions needed to trigger hibernation to a swapfile. This must be explicitly allowed via custom SELinux policy modules — a Fedora-specific requirement.

!!! important "s2idle only"
The Framework 16 AMD only supports `s2idle` (suspend-to-idle / S0ix), not S3 deep sleep. This is a firmware limitation, not an OS one. Hibernate itself (S4) works fine and is what this guide sets up.

---

## Prerequisites

- Fedora installed with btrfs root (default Fedora install)
- zram swap active (default Fedora install — verify with `swapon --show`)
- Enough free disk space for the swapfile (see Step 2)
- BIOS up to date (check [knowledgebase.frame.work](https://knowledgebase.frame.work/bios-and-drivers-downloads-rJ3PaCexh))

---

## Step 1 — Create the btrfs subvolume for swap

Btrfs swapfiles must live on a subvolume with No_COW (no copy-on-write) and no compression. Creating a dedicated subvolume is the correct approach — `btrfs filesystem mkswapfile` handles the No_COW flag automatically:

```bash
sudo btrfs subvolume create /var/swap
```

!!! note
Btrfs COW and compression are incompatible with swapfiles — the kernel requires swapfiles to have contiguous, non-compressed extents. A dedicated subvolume lets you disable these without affecting the rest of the filesystem.

**(Optional) Verify No_COW and compression are correctly set:**

```bash
# C flag in output = No_COW correctly set
lsattr /var/swap/swapfile | cut -c1-20

# Should return empty = no compression (correct)
btrfs property get /var/swap/swapfile compression

# Check subvolume flags
btrfs subvolume show /var/swap | grep -i "compress\|flags"
```

---

## Step 2 — Calculate the required swapfile size

Check your current zram size:

```bash
swapon --show
```

**The recommended (safe) formula:**

```
swapfile_size = ram_size + zram_size
```

**Why:** When hibernating, the kernel compresses RAM contents into zram (roughly 2:1 ratio), then writes both the uncompressed remainder and the zram contents to the swapfile. The formula assumes RAM is nearly full — in practice your hibernate image will be smaller since it only writes pages actually in use.

**The minimum formula** (use only if disk space is very tight):

```
swapfile_size = ram_size - zram_size
```

This works if you never hibernate with RAM nearly full, but risks a failed hibernate if RAM is heavily loaded.

**Examples:**

| RAM   | zram  | Safe (recommended) | Minimum |
| ----- | ----- | ------------------ | ------- |
| 32 GB | 8 GB  | 40 GB              | 24 GB   |
| 64 GB | 8 GB  | 72 GB              | 56 GB   |
| 64 GB | 16 GB | 80 GB              | 48 GB   |

Check your typical RAM usage:

```bash
free -h
```

!!! tip
If you consistently have lots of free RAM when hibernating, the minimum formula is safe for your workload. The safe formula is recommended regardless — disk space is cheaper than a corrupted resume.

---

## Step 3 — Create the swapfile

```bash
sudo btrfs filesystem mkswapfile --size 72g --uuid clear /var/swap/swapfile
```

Replace `72g` with your calculated size. The `--uuid clear` flag is required — it removes the btrfs UUID from the file so the kernel treats it as a plain swapfile.

Enable it:

```bash
sudo swapon /var/swap/swapfile
```

Verify (both zram and the swapfile should appear):

```bash
swapon --show
```

**To resize later** (btrfs swapfiles cannot be resized in place):

```bash
sudo swapoff /var/swap/swapfile
sudo rm /var/swap/swapfile
# Recreate at new size, then re-derive offset — see Gotchas
sudo btrfs filesystem mkswapfile --size NEW_SIZE --uuid clear /var/swap/swapfile
sudo swapon /var/swap/swapfile
```

---

## Step 4 — Find the swapfile UUID and offset

### UUID (of the filesystem, not the file itself):

```bash
findmnt -no UUID -T /var/swap/swapfile
```

Example: `db92b2a3-b007-4f8f-8349-73276a3fe5be` — call it `SWAP_UUID`.

### Physical offset:

```bash
sudo btrfs inspect-internal map-swapfile -r /var/swap/swapfile
```

Example: `6148378` — call it `SWAP_OFFSET`.

!!! warning "Never use filefrag for btrfs"
Never use the `filefrag` method for btrfs. Unlike ext4/xfs, btrfs has its own internal extent layout. The `btrfs inspect-internal map-swapfile -r` command gives the correct physical offset directly with no math required. Using `filefrag` will give you a wrong offset and a broken hibernate.

---

## Step 5 — Add the swapfile to `/etc/fstab`

```bash
sudo nano /etc/fstab
```

Add at the end:

```
/var/swap/swapfile    none    swap    defaults,pri=0    0 0
```

!!! note
`pri=0` sets the swapfile's priority as low as possible. zram runs at priority 100 and is always used first. The swapfile is only written to during hibernation or if zram is completely exhausted — not as everyday swap. If you already have the swapfile in fstab without `pri=0`, add it — the system won't break without it but it's better practice.

---

## Step 6 — Add kernel parameters for hibernate resume

```bash
sudo grubby --update-kernel=ALL --args="resume=UUID=SWAP_UUID resume_offset=SWAP_OFFSET"
```

Replace with your actual values from Step 4. Example:

```bash
sudo grubby --update-kernel=ALL --args="resume=UUID=db92b2a3-b007-4f8f-8349-73276a3fe5be resume_offset=6148378"
```

!!! important
Without both parameters, the kernel either cannot find the hibernate image at all or reads from the wrong location. `resume=UUID=...` identifies the block device; `resume_offset=...` identifies where within it the swapfile begins.

!!! note
Parameters are inherited automatically on kernel updates. You do not need to rerun this when a new kernel is installed.

---

## Step 7 — Rebuild the initramfs

The initramfs must include the resume hook to restore from hibernate before the root filesystem is mounted:

```bash
# Single kernel installed:
sudo dracut -f

# Multiple kernels installed (recommended — rebuilds all):
sudo dracut --force --regenerate-all
```

**Verify the resume module is present:**

```bash
ls /usr/lib/dracut/modules.d/ | grep resume
```

You should see a directory with `resume` in the name — the number prefix (e.g. `74resume`, `85resume`) varies by Fedora and dracut version and doesn't matter. Any `NNresume` entry is correct. If no entry containing `resume` appears at all:

```bash
sudo dnf install dracut-util
sudo dracut --force --regenerate-all
```

!!! note
Fedora's kernel-install hook rebuilds the initramfs automatically when a new kernel is installed. You do not need to rerun dracut on kernel updates.

---

## Step 8 — Fix SELinux labeling

Fedora enforces SELinux and by default denies systemd-logind access to the swapfile path. Add the correct permanent security context:

```bash
sudo semanage fcontext -a -t swapfile_t '/var/swap(/.*)?'
sudo restorecon -RF /var/swap
```

!!! note
This is a Fedora-specific step. Distros without SELinux enforcing (Arch, Ubuntu default, etc.) can skip it. Without it, hibernate silently fails or returns immediately to the login screen.

---

## Step 9 — Reboot

```bash
sudo reboot
```

!!! important
A clean reboot is required so the audit log is fresh before the SELinux policy steps. Leftover audit events from normal use will pollute the generated policy.

---

## Step 10 — Generate and load SELinux policy (first pass)

After logging back in, **do nothing else** before running these commands.

Attempt to hibernate — it will fail, that is expected:

```bash
sudo systemctl hibernate
```

Check the audit log:

```bash
sudo audit2allow -b
```

**Expected output — Fedora 40 through 44:**

```
#============= systemd_logind_t ==============
allow systemd_logind_t swapfile_t:dir search;
```

This first-pass rule is consistent across Fedora 40–44. The rules relevant to hibernate will always involve `systemd_logind_t`, `systemd_sleep_t`, or `swapfile_t`.

!!! warning
Only proceed with generating the policy if the output contains rules involving `systemd_logind_t`, `systemd_sleep_t`, or `swapfile_t` exclusively. If you see anything else, reboot and redo this step (yes, you have to reboot again) with a clean audit log.

Generate and load the policy:

```bash
cd /tmp
sudo audit2allow -b -M systemd_hibernate
sudo semodule -i /tmp/systemd_hibernate.pp
```

---

## Step 11 — Reboot again, then second SELinux policy pass

```bash
sudo reboot
```

After logging in, attempt hibernate again immediately:

```bash
sudo systemctl hibernate
sudo audit2allow -b
```

**Expected output — Fedora 40:**

```
#============= systemd_sleep_t ==============
allow systemd_sleep_t self:capability sys_admin;
```

**Expected output — Fedora 41–44:**

```
#============= systemd_sleep_t ==============
allow systemd_sleep_t swapfile_t:dir search;
```

!!! warning
Always trust `audit2allow -b` output **over any guide, including this one** — hibernate-related rules will always involve `systemd_logind_t`, `systemd_sleep_t`, or `swapfile_t`. If you see rules involving anything else, reboot and redo this step (yes, you have to reboot again) with a clean audit log.

!!! note
The rule changed between Fedora 40 and later versions. On Fedora 41+ the base SELinux policy already grants `sys_admin` capability to `systemd_sleep_t` so it no longer appears as a denial — instead a directory search permission on the swapfile path is what's missing. Future Fedora versions may differ further.

Generate and load:

```bash
cd /tmp
sudo audit2allow -b -M systemd_hibernate2
sudo semodule -i /tmp/systemd_hibernate2.pp
```

---

## Step 12 — WiFi module reload script

### Why this is needed

The AMD RZ616 (kernel module: `mt7921e`) — the default WiFi card in the Framework 16 — has a hardware-level power state bug. When the system hibernates, the card enters PCIe D3cold. On resume, `mt7921e` frequently fails to transition back from D3cold to D0, leaving WiFi completely dead. This is a well-documented issue across multiple Linux distributions. The fix is to unload the module before hibernate and reload it after resume.

### Identify your WiFi module

```bash
lspci -k | grep -A2 -i "network\|wireless"
```

Look for `Kernel driver in use:`.

| Card                        | Kernel module |
| --------------------------- | ------------- |
| AMD RZ616 (MediaTek MT7922) | `mt7921e`     |
| Intel Wi-Fi 6E AX210        | `iwlwifi`     |
| Intel Wi-Fi 6 AX200         | `iwlwifi`     |

### Create the script

The filename can be anything executable in `/usr/lib/systemd/system-sleep/` — systemd-sleep runs all of them:

```bash
sudo nano /usr/lib/systemd/system-sleep/wifi-hibernate.sh
```

```bash
#!/bin/bash
WiFiModule=mt7921e

case "$1 $2" in
  "pre hibernate" | "pre suspend-then-hibernate")
    modprobe -r $WiFiModule
    ;;
  "post hibernate" | "post suspend-then-hibernate")
    modprobe $WiFiModule
    ;;
esac
```

```bash
sudo chmod +x /usr/lib/systemd/system-sleep/wifi-hibernate.sh
```

!!! note
The script only triggers on `hibernate` and `suspend-then-hibernate` — not regular suspend. WiFi is unaffected during normal sleep/wake cycles.

### If you switch to OR already have Intel AX210 (iwlwifi)

`iwlwifi` generally handles hibernate resume correctly on modern kernels (6.10+) without a reload script.

1. **Update WiFi firmware first:**
   ```bash
   sudo fwupdmgr refresh && sudo fwupdmgr update
   ```
2. **Test hibernate without the script.** The script is not required for AX210.
3. **Only if WiFi is dead after hibernate resume:** update `WiFiModule=iwlwifi` in the script. Note that unloading `iwlwifi` also unloads dependent modules (`iwlmvm`, `mac80211`) — if reload fails for any reason you'll have no WiFi until reboot. Use this as a fallback only.

### If you change cards in the future

```bash
lspci -k | grep -A2 -i "wireless"   # find new module name
# Update WiFiModule= in the script
# Test with: sudo systemctl hibernate
```

---

## Step 13 — Test hibernate ✓

Reboot once to make sure everything so far is applied cleanly. After logging back in, open some applications — a browser tab, a text editor, anything — so you can clearly confirm the session was restored rather than a fresh boot to an empty desktop. Then:

```bash
sudo systemctl hibernate
```

The system should:

1. Write RAM contents to the swapfile — this takes longer than a regular suspend, proportional to how much RAM is in use
2. Power off completely — fan stops, all lights out
3. On pressing the power button, boot and fully restore your session

If your session is fully restored — every window, every tab, right where you left it — congratulations. Hibernate on Linux, on a Framework 16, on btrfs, with SELinux enforcing, is not a trivial thing to get working. You did it.

---

## (Optional) Step 14 — Configure suspend-then-hibernate timing

Core setup is complete after Step 13. This step is a recommended quality-of-life improvement but entirely your call.

By default, your system will suspend (s2idle) indefinitely when you close the lid or it goes idle — consuming a small but continuous amount of battery the entire time. On my Framework 16 AMD 7040, s2idle draws approximately **~1.145% battery per hour**. That's manageable for short absences but adds up — 8 hours suspended overnight is roughly 9% battery gone doing nothing. With suspend-then-hibernate configured, it suspends first for fast resume when you return quickly, then automatically hibernates after a delay if untouched, consuming zero battery until you power it back on. For a laptop you carry around or leave closed for hours, this is the better behavior.

To enable it, set how long to stay in suspend before hibernating:

```bash
sudo nano /etc/systemd/sleep.conf
```

```ini
[Sleep]
HibernateDelaySec=3600
```

`3600` = 1 hour. `7200` = 2 hours. Adjust to your workflow.

**In KDE System Settings → Power Management**, set **"When sleeping, enter:"** to **"Standby, then hibernate"** on both AC and Battery tabs.

---

## Gotchas and known issues

### ⚠️ amdgpu display artifacts or freeze after hibernate resume

If you experience graphical corruption, flickering, or a complete hang requiring reboot after resuming from hibernate, follow this order:

**Step 1 — add these parameters first** (broadly recommended for the 7040 series regardless of hibernate, lower battery impact):

```bash
sudo grubby --update-kernel=ALL --args="amdgpu.sg_display=0 amdgpu.dcdebugmask=0x410"
```

- `amdgpu.sg_display=0` — disables scatter-gather display, a source of resume artifacts
- `amdgpu.dcdebugmask=0x410` — disables Panel Self-Refresh (PSR), PSR-SU, and Panel Replay which cause display corruption

Reboot and test.

**Step 2 — only if artifacts persist after Step 1** (workaround, costs some battery life, not personally tested — found in community reports):

```bash
sudo grubby --update-kernel=ALL --args="amdgpu.runpm=0"
```

Disables GPU runtime power management entirely, eliminating VRAM state corruption on resume. Check if a kernel update resolves the issue before committing to this permanently.

---

### ⚠️ Offset must be updated after swapfile or partition changes

`resume_offset` points to the physical location of the swapfile's first extent on disk. This changes if you:

- Delete and recreate the swapfile (e.g. to resize it)
- Repartition your btrfs partition (expand, shrink, or restore from backup to a different layout)

!!! danger
Hibernating with a stale `resume_offset` after a partition or swapfile change will result in data corruption or a broken resume. Always re-derive the offset before the next hibernate.

**After any such operation, before hibernating:**

```bash
# 1. Get the new offset
sudo btrfs inspect-internal map-swapfile -r /var/swap/swapfile

# 2. Update the kernel parameter
sudo grubby --update-kernel=ALL --args="resume_offset=NEW_OFFSET"

# 3. Rebuild all initramfs images
sudo dracut --force --regenerate-all

# 4. Reboot and verify
cat /proc/cmdline | tr ' ' '\n' | grep resume
```

!!! note
If you shrink a Windows partition and expand your btrfs partition, the btrfs physical extent layout shifts even if you don't touch the swapfile. The offset becomes invalid. This applies to Clonezilla backup → repartition → restore workflows too — always re-derive the offset after any partition boundary change before hibernating.

---

### Snapper hourly wakes from suspend (if Snapper is configured)

!!! note
Only relevant if you have Snapper set up for btrfs snapshots. Snapper is not installed by default on Fedora KDE. If you didn't set it up, skip this section.

If your system wakes from suspend hourly when untouched, Snapper's timeline timer may be the cause. Diagnose:

```bash
# Check timers — look for snapper-timeline.timer
systemctl list-timers --all | grep snapper

# Confirm hourly resume pattern in kernel log
journalctl -b -k | grep -E "SMU is resumed|PM: resume devices" | head -20

# Check what triggered each resume
journalctl -b | grep -i "wake\|wakeup" | grep -v kernel | head -20
```

If hourly resumes correlate with snapper-timeline.timer, prevent it from waking the system:

```bash
sudo systemctl edit snapper-timeline.timer
```

```ini
[Timer]
WakeSystem=false
```

```bash
sudo systemctl daemon-reload
```

Snapper still takes hourly snapshots when the system is already awake — it just won't wake it from sleep to do so. You can also manage snapshot frequency and retention via **Btrfs Assistant** (available in Fedora repos) as a GUI alternative.

---

## Verification checklist

```bash
# Both resume parameters present in running kernel
cat /proc/cmdline | tr ' ' '\n' | grep resume
# Must show: resume=UUID=... AND resume_offset=...

# Swapfile active with correct priority
swapon --show
# zram at pri=100, swapfile at pri=0 or pri=-1

# SELinux policy modules loaded
sudo semodule -l | grep hibernate
# Should show: systemd_hibernate and systemd_hibernate2

# WiFi script executable
ls -la /usr/lib/systemd/system-sleep/wifi-hibernate.sh

# (Optional) No_COW correctly set on swapfile (C flag must be present)
lsattr /var/swap/swapfile | cut -c1-20

# Hibernate delay configured (if Step 14 was done)
grep HibernateDelaySec /etc/systemd/sleep.conf
```

---

## Quick reference

```bash
# Re-derive swapfile offset after any partition/swapfile change
sudo btrfs inspect-internal map-swapfile -r /var/swap/swapfile

# Update resume_offset
sudo grubby --update-kernel=ALL --args="resume_offset=NEW_OFFSET"

# Rebuild initramfs — all kernels
sudo dracut --force --regenerate-all

# Rebuild initramfs — current kernel only
sudo dracut -f

# Manual hibernate test
sudo systemctl hibernate

# Check what woke system from sleep
journalctl -b -k | grep -i "resume\|wakeup"

# Check SELinux denials after a failed hibernate attempt
sudo audit2allow -b
```

---

## References

- [Framework Community — Hibernate w/ swapfile setup on Fedora 40](https://community.frame.work/t/guide-framework-16-hibernate-w-swapfile-setup-on-fedora-40/53080)
- [Framework Linux docs — Hibernate on Fedora (automatic)](https://github.com/FrameworkComputer/linux-docs/blob/main/hibernation/hibernate-fedora-automatic.md)
- [Framework Community — WiFi problems after hibernate](https://community.frame.work/t/guide-solution-for-wifi-problems-after-hibernate-non-systemd/52332)
- [AMD s2idle diagnostic script](https://gitlab.freedesktop.org/drm/amd/-/blob/master/scripts/amd_s2idle.py)

---

© TrapStoner — Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
