const SpotifyWebApi = require("spotify-web-api-node");
const { HttpServer, getConfig } = require("raraph84-lib");
const Config = getConfig(__dirname);

const spotifyApi = new SpotifyWebApi({
    clientId: Config.clientId,
    clientSecret: Config.clientSecret,
    redirectUri: "http://localhost:8080/callback"
});

const api = new HttpServer();
api.on("request", async (/** @type {import("raraph84-lib/src/Request")} */ request) => {

    if (!request.searchParams.has("code") && !spotifyApi.getAccessToken()) {

        request.setHeader("Location", spotifyApi.createAuthorizeURL(["user-library-read"]));
        request.end(302);

    } else if (request.searchParams.has("code") && !spotifyApi.getAccessToken()) {

        try {
            spotifyApi.setAccessToken((await spotifyApi.authorizationCodeGrant(request.searchParams.get("code"))).body.access_token);
        } catch (error) {
            request.setHeader("Location", spotifyApi.createAuthorizeURL(["user-library-read"]));
            request.end(302);
            return;
        }

        request.setHeader("Location", "/");
        request.end(302);

    } else if (request.searchParams.has("code") && spotifyApi.getAccessToken()) {

        request.setHeader("Location", "/");
        request.end(302);

    } else {

        const fetchLikedTracks = async (offset = 0) => {
            const likedTracks = await spotifyApi.getMySavedTracks({ limit: 50, offset });
            return likedTracks.body.next ? likedTracks.body.items.concat(await fetchLikedTracks(offset + 50)) : likedTracks.body.items;
        }

        const likedTracks = (await fetchLikedTracks()).map((track) => track.track.name + " - " + track.track.artists.map((artist) => artist.name).join(" "));
        const duplicates = likedTracks.filter((track, index) => likedTracks.indexOf(track) !== index);

        request.end(200, { likedTracks, duplicates });
    }
});
api.listen(8080).then(() => console.log("Listening ! Go to http://localhost:8080"));
