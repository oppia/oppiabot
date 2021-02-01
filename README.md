# Oppiabot

<p align="center">
    <img src="images/oppiabot-display-image.png">
</p>

Oppiabot is a GitHub app built with [probot](https://github.com/probot/probot). It acts as a helper for the Oppia code repository to maintain the development workflow. It is hosted on [Heroku](https://www.heroku.com/).

The bot currently performs the following functions:

1. Checks whether a contributor creating a pull request has signed the CLA. It adds a label `Needs CLA` accordingly.

2. Checks merge conflict in a pull request and notifies the author of the pull request if there is a merge conflict.

3. Closes stale pull requests.


## Getting started

Please refer to the following instructions to setup Oppiabot for the first time on your machine:

1. Create a new, empty folder called `opensource/` within your home folder. Navigate to it (`cd opensource`), then [fork and clone](https://help.github.com/articles/fork-a-repo/) the Oppiabot repo. This will create a new folder named `opensource/oppiabot`. Navigate to `opensource/oppiabot/`.

2. Install [Node.Js](https://nodejs.org/) and [NPM](https://www.npmjs.com/) on your machine using the following commands:

    #### Using Ubuntu
    ```bash
    curl -sL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```
    
    #### Using Debian, as root
    ```bash
    curl -sL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y nodejs
    ```
       
    #### Using MacOS
    ```bash
    sudo brew install node
    ```
    
3. Setup probot and other dependencies by running the following command:
  ```bash
    npm install
  ```

4. The Oppiabot uses environment variables. These are configured in the server settings. To deploy the bot locally, create a `.env` file and copy the contents of `.env.example` to it. You will need to adjust these variables accordingly following the instructions in the subsequent steps.

5. Go to [smee.io](https://smee.io/) and click **Start a new channel**. Set `WEBHOOK_PROXY_URL` in `.env` to the URL that you are redirected to.

6. [Create a new GitHub App](https://github.com/settings/apps/new) with:
    * **Webhook URL**: Use your `WEBHOOK_PROXY_URL` from the previous step.
    * **Webhook Secret**: `development`
    * **Permissions & events** is located lower down the page and will depend on what data you want the bot to have access to. Currently, the bot requires read and write access to issues and pull requests and read-only access to the file in the path `.github/stale.yml`.
    If, for example, you only enable issue events, you will not be able to listen on pull request webhooks with the bot.

7. Download the private key. It will be a `.pem` file. Move it to the root directory of the project. As long as it's in the root directory, it will be automatically detected regardless of the filename.

8. Edit `.env` and set `APP_ID` to the ID of the app you just created. The App ID can be found in your app settings page here.

<p align="center">
    <img src="images/sample-app-id.png">
</p>


## Installing the bot on a repository

You'll need to identify a target repository and install the bot by clicking the **Install** button on the settings page of your app, e.g `https://github.com/apps/your-app-name`


## Running the bot locally

You are now ready to run the bot on your local machine. Run `npm run dev` to start the server.
The `dev` script will start the bot using [nodemon](https://github.com/remy/nodemon#nodemon), which will watch for any files changes in your local development environment and automatically restart the server.

### Other available scripts

`$ npm start` to start the bot without watching files.


## Debugging
Always run `$ npm install` and restart the server if `package.json` has changed.
To turn on verbose logging, start server by running: `$ LOG_LEVEL=trace npm start`.


## Support

If you have any feature requests or bug reports, please log them on our [issue tracker](https://github.com/oppia/oppiabot/issues/new?title=Describe%20your%20feature%20request%20or%20bug%20report%20succinctly&body=If%20you%27d%20like%20to%20propose%20a%20feature,%20describe%20what%20you%27d%20like%20to%20see.%20Mockups%20would%20be%20great!%0A%0AIf%20you%27re%20reporting%20a%20bug,%20please%20be%20sure%20to%20include%20the%20expected%20behaviour,%20the%20observed%20behaviour,%20and%20steps%20to%20reproduce%20the%20problem.%20Console%20copy-pastes%20and%20any%20background%20on%20the%20environment%20would%20also%20be%20helpful.%0A%0AIf%20the%20issue%20you%27re%20facing%20is%20probot-specific,%20it%20should%20be%20logged%20to%20the%20probot%20repository.%0A%0AThanks!).

Please report security issues directly to admin@oppia.org.

## License

The Oppiabot code is released under the [Apache v2 license](https://github.com/oppia/oppiabot/blob/master/LICENSE).
