---
title: PermX Walkthrough — HackTheBox
published: true
---

![Congrats Screen Of HTB machine PermX](https://miro.medium.com/v2/resize:fit:720/format:webp/1*_d1GtfPjVEoaekQliy8MHg.png)

# Introduction

In this write-up, We’ll go through an easy Linux machine where we first gain initial foothold by exploiting a CVE, followed by manipulating Access Control Lists (ACL) to achieve root access.

# Reconnaissance

1. After Starting the machine, I set my target IP as $target environment variable and ran nmap command.

Command — Port Scan: Nmap

nmap $target --top-ports=1000 -sV -v -sC  -Pn > nmap.out

2. Then, As usual I added the host:permx.htb in /etc/hosts.

3. While enumerating the website, I started directory fuzzing and subdomain fuzzing in the background.

Command — Subdomain Fuzzing: Fuff

ffuf -w /home/mrrobot/Downloads/wordlists/SecLists/Discovery/DNS/subdomains-top1million-20000.txt -u http://permx.htb/ -H "Host:FUZZ.permx.htb" -v -fw 18

Command — Directory Fuzzing: Gobuster

gobuster dir -u http://permx.htb -w /home/mrrobot/Downloads/wordlists/SecLists/Discovery/Web-Content/raft-medium-directories.txt

4. Let’s Explore the Subdomain: lms.permx.htb which seems interesting.

5. Using Wappalyzer, I found that the version is Chamilo version 1.

6. When checking for ‘chamilo lms exploit’, I came across this link.

Exploit: https://github.com/m3m0o/chamilo-lms-unauthenticated-big-upload-rce-poc

# Initial Foothold

    Learn about the exploit in this link

Article: https://starlabs.sg/advisories/23/23-4220/

### CVE-2023–4220 Description

    Unrestricted file upload in big file upload functionality in /main/inc/lib/javascript/bigupload/inc/bigUpload.php in Chamilo LMS <= v1.11.24 allows unauthenticated attackers to perform stored cross-site scripting attacks and obtain remote code execution via uploading of web shell.

2. You can also use the knowledge from the above article to exploit this vulnerability or also you can use the above Github tool to easily to exploit it.

3. I used the PHP reverse shell from PentestMonkey to craft a reverse shell and followed the PoC (Proof of Concept) in that article to get a reverse shell.

PHP Reverse Shell: https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/master/php-reverse-shell.php

### Exploit:

### Reverse Shell Listener:

Command — Spawn Bash shell: python one-liner

python3 -c 'import pty;pty.spawn("/bin/bash")'

    The above command will spawn the bash shell which is more stable.
    Now, as a www-data user, We don’t have much permission.

# Lateral Movement

## i. User Flag

1. After checking what files are available in the system. I thought of finding files which are owned by ’www-data’

Command — Files owned by a user: find

find / -user www-data 2>/dev/null | grep -v '/proc\|/run\|/var/www'

2. I tried running linpeas, but nothing interesting turned out. But I found an interesting file ‘configuration.php’.

3. So I ran a find command to check for any other ‘configuration.php’ file in chamilo application.

Command — Finding config file: find

find / -name configuation.php 2>/dev/null

4. Upon opening the file ‘/var/www/chamilo/app/config/configuration.php’, I found the ‘database connection settings’![[Pasted image 20240912180357.png]]

5. There are two users in this system. We can find this using the following command:

Command — Finding users: /etc/passwd

cat /etc/passwd | grep

6. Let’s try ssh using the password from the configuration file.

## ii. Root Flag

1. Now, We have a low privileged user access. First run the usual command to find the sudo privileged files.

Command — Sudo Privileged files: sudo

sudo -l

2. Let’s read the contents of the file ‘/opt/acl.sh’.

3. Understand the script and it’s functionality.

Things to Note

    This script uses sudo setfacl to assign the specified permissions to the given user.

    $1: user — the user for whom ACL permissions will be set.
    $2: perm — the permissions (e.g., rwx).
    $3: file — the file on which permissions will be set.

    The script gets three arguments: user, permission, target file.

    We can use this script to modify permissions of any file which is in the home directory of user ‘mtz’.

    If we able to link any important to a file in the home directory of mtz, we can change the permission using the /opt/acl.sh script.

Command — Symbolic link: ln

ln -s /etc/passwd /home/mtz/passwd1

4. This command creates a symbolic link of the ‘/etc/passwd’ file to a file ‘/home/mtz/passwd1’.

5. Since this symbolic file is in the home directory of the user ‘mtz’, we can change the permission of the file using the available script ‘/opt/acl.sh’.

Command — Using the script: /opt/ach.sh

sudo /opt/acl.sh mtz rwx /home/mtz/passwd1

6. This command changes the permission of the symbolic file /home/mtz/passwd1.

7. Now, We can just delete the password of the root and change the user to ‘root’.

8. We just deleted the ‘x’ in root:x:0:0:root:/root:/bin/bash. It will delete the password of the root.

9. Then we can use the command su root to become root.

Now, We are ROOT! Thanks for Reading. Happy hacking!!