/************************************************************************
                            DISCLAIMER

This is just a playground package. It does not comply with best practices
of using AWS-UI components. For production code, follow the integration
guidelines:

https://polaris.corp.amazon.com/getting_started/development/integration/
************************************************************************/
import React from 'react';
import { Route } from 'react-router-dom';
import BobRossIntro from './BobRossIntro.jsx';
import Dashboard from './Dashboard.jsx';
import CarbonLake101 from './CarbonLake101.jsx';
import SetupGuide from './SetupGuide.jsx';
import DataUploader from './DataUploader.jsx';
import AccountSettings from './AccountSettings.jsx';
// import Visualizations from './Visualizations.jsx';
import Basic from './BasicLayout.jsx';
import ServiceHomepage from './ServiceHomepage.jsx';
import CreateForm from './CreateForm.jsx';
import TableView from './EmissionRecords.jsx';
import EmptyTableView from './TableWithEmptyState.jsx';

import '@awsui/global-styles/index.css';


// Amplify
import Amplify from 'aws-amplify';
import awsconfig from '../aws-exports';
import { AmplifySignOut, withAuthenticator} from '@aws-amplify/ui-react'


Amplify.configure(awsconfig);
// Class App is the "output" generated on every build,
// it is what you will see on the webpage.
function App() {
    return (
      // When you create a new file or template, add it below
      // as a new 'Route' so you can link to it with a url.

      <div>
        {/* <Route exact path="/" component={BobRossIntro} /> */}
        {/* <Route exact path="/" component={CarbonLake101} /> */}
        {/* <Route exact path="/" component={Dashboard} /> */}
        <Route  path="/carbonlake-101" component={CarbonLake101} />
        <Route  path="/setup-guide" component={SetupGuide} />
        <Route  path="/data-uploader" component={DataUploader} />
        <Route  path="/account-settings" component={AccountSettings} />
        {/* <Route exact path="/visualizations" component={Visualizations} /> */}
        <Route path="/basic" component={Basic} />
        <Route path="/service-home" component={ServiceHomepage} />
        <Route path="/create" component={CreateForm} />
        <Route path="/emission-records" component={TableView} />
        <Route path="/table-empty" component={EmptyTableView} />
        <Route path='/about-carbonlake' component={() => {
            window.location.href = 'https://aws.amazon.com';
          return null;
        }}/>
        <Route path='/submit-issue' component={() => {
            window.location.href = 'https://github.com';
          return null;
        }}/>

        <AmplifySignOut />
      </div>
    );

}
export default withAuthenticator(App);
