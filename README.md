1. expo + react native + tailwind css
2. start using npm expo start
3. need expo installed
4. also need adb installed
5. on initial build would get error regarding missing sdk path, for that update the srcDir inside .android folder
6. app is currently using react persist + async store for all data types, need to move that logic to sqlite backed storage.
7. application .env contains api keys which need yo be placed inside external api or something in future plan
8. use .nvmrc to use specific node version via nvm
9. application build might cause issue with react-reanimate and react-worklets as they have intersecting implementation. please install them in particular order which does not cause this issue.
10. app is using non linear navigatiom strucute, need to resolve it first. the gorham-bottomsheets were used for audio player which should be moved to dedicated tab/screen.
11. app is currently having issue on audio management section xause of missing storage implementation.
12. need to determine storage policy + how to sync with third party solutions like onedrive n drive
13. currntly the repo is co figured for linux env. if using windows please update paths inside app.json
