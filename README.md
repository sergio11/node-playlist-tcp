# node-playlist-tcp

In this practice a modification of the UDP application is made: it will adapt RTP sender to send RTP packets to the IP address of a client in
rather than the IP of a group multicast. 
For this purpose, the customer must connect to a server port and through commands entered through
of a prompt, Manage the playlist server. They define six Possible commands:

list: lists of songs available to listen
play: starts playing the list, default stop
pause: stops playback at a specific point in a song
next: Request playing the next song
prev: requests playback of the previous track
exit: the session ends

Since the application is based on a shell, it will remain necessary an audio player that supports RTP point to the IP address
machine from which the connection to the application is performed.