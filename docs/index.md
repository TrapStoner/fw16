<div align="center"><a name="readme-top"></a>

# just some framework 16 guides

![Framework](https://img.shields.io/badge/Framework%2016-000000?style=for-the-badge&logo=framework&logoColor=white)
![Fedora](https://img.shields.io/badge/Fedora-51A2DA?style=for-the-badge&logo=fedora&logoColor=white)
![KDE](https://img.shields.io/badge/KDE%20Plasma-1D99F3?style=for-the-badge&logo=kde&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)
![Docs](https://img.shields.io/badge/Docs-grey?style=for-the-badge&logo=readthedocs&logoColor=white)

<br/>

I've spent **just a tad bit** of hours shaping and chiseling Linux into perfection on my Framework 16. Some of it was fun. Some of it was me staring at a Linux recovery mode terminal at 4am, won't lie. It's all in the spirit of learning and improving.

This repo is where I document the things I figured out — for my future reference, and hopefully they can be just as useful to a handful of people too. One guide that actually explains _why_, not just _what_.

</div>

## My setup

```brainfuck
Machine      Framework 16 · AMD Ryzen 9 7940HS · AMD Radeon 780M
WiFi         AMD RZ616 (MediaTek MT7922)
OS           Fedora 44
Desktop      KDE Plasma 6.x · Wayland
Filesystem   btrfs
Kernel       7.x
```

---

## About these guides

The guides are written from my setup but they try hard not to be _about_ my setup. Where possible they explain the underlying reasoning, cover alternatives, and flag where things might differ for you. The goal is that someone on Fedora 42, or Arch, or with different hardware can still follow along and adapt as needed.

If you notice repeated explanations across guides — that's intentional. Each guide is written to stand alone and be useful to someone who landed on it directly without reading anything else first, even if they're not deep in the Linux rabbit hole yet.

!!! tip
Have you tried corrupting your bootloader yet? TRUST ME it's lots of fun I swear... <br/>
<sub>just remember to make a full disk image with clonezilla **_BEFORE_** the point of no return</sub>

---

## Guides

| Guide                                                                          | Description                                                                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| [Hibernate Setup — Framework 16 AMD (Fedora)](guides/hibernate-fedora-fw16.md) | Full hibernate setup on btrfs with swapfile, SELinux policy, WiFi fix, and suspend-then-hibernate config |

---

## License

© TrapStoner — Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)  
Use it, share it, adapt it. Just credit where it came from.
