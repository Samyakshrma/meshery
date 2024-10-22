import React, { useState, useRef } from 'react';
import MenuIcon from '@material-ui/icons/Menu';
import { useRouter } from 'next/router';
import { Provider, connect } from 'react-redux';
import { store } from '../store';
import { bindActionCreators } from 'redux';
import { useGetLoggedInUserQuery, useLazyGetTokenQuery } from '@/rtk-query/user';
import { updateUser } from '../lib/store';
import ExtensionPointSchemaValidator from '../utils/ExtensionPointSchemaValidator';
import { useNotification } from '@/utils/hooks/useNotification';
import { EVENT_TYPES } from 'lib/event-types';
import CAN from '@/utils/can';
import { keys } from '@/utils/permission_constants';
// import { Logout, Settings, VpnKey } from '@material-ui/icons';
import { NavigationNavbar } from '@layer5/sistent';
import { Popover, IconButton } from '@material-ui/core';
import { UsesSistent } from './SistentWrapper';
import theme from '@/themes/app';

function exportToJsonFile(jsonData, filename) {
  let dataStr = JSON.stringify(jsonData);
  let dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  let linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', filename);
  linkElement.click();
  linkElement.remove();
}

const HeaderMenu = (props) => {
  const [userLoaded, setUserLoaded] = useState(false);
  const [account, setAccount] = useState([]);
  const capabilitiesLoadedRef = useRef(false);
  const { notify } = useNotification();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState(null);

  const {
    data: userData,
    isSuccess: isGetUserSuccess,
    isError: isGetUserError,
    error: getUserError,
  } = useGetLoggedInUserQuery();

  const [triggerGetToken, { isError: isTokenError, error: tokenError }] = useLazyGetTokenQuery();

  const { capabilitiesRegistry } = props;

  const handleLogout = () => {
    window.location = '/user/logout';
    handleClose();
  };

  const handlePreference = () => {
    router.push('/user/preferences');
    handleClose();
  };

  const handleGetToken = () => {
    triggerGetToken()
      .unwrap()
      .then((data) => {
        exportToJsonFile(data, 'auth.json');
        handleClose();
      });
  };

  if (!userLoaded && isGetUserSuccess) {
    props.updateUser({ user: userData });
    setUserLoaded(true);
  } else if (isGetUserError) {
    notify({
      message: 'Error fetching user',
      event_type: EVENT_TYPES.ERROR,
      details: getUserError?.data,
    });
  }

  if (isTokenError) {
    notify({
      message: 'Error fetching token',
      event_type: EVENT_TYPES.ERROR,
      details: tokenError?.data,
    });
  }

  if (!capabilitiesLoadedRef.current && capabilitiesRegistry) {
    capabilitiesLoadedRef.current = true;
    setAccount(ExtensionPointSchemaValidator('account')(capabilitiesRegistry?.extensions?.account));
  }

  const getAccountNavigationItems = () => {
    // Convert account extensions to navigation items
    const accountItems = account.map((item) => ({
      id: item.id,
      title: item.title,
      onClick: () => {
        if (item.href) {
          router.push(item.href);
          handleClose();
        }
      },
      permission: typeof item.show === 'undefined' ? true : item.show,
    }));

    // Default menu items that should always be present
    const defaultItems = [
      {
        id: 'get-token',
        title: 'Get Token',
        onClick: handleGetToken,
        permission: CAN(keys.DOWNLOAD_TOKEN.action, keys.DOWNLOAD_TOKEN.subject),
      },
      {
        id: 'preferences',
        title: 'Preferences',
        onClick: handlePreference,
        permission: true,
      },
      {
        id: 'logout',
        title: 'Logout',
        onClick: handleLogout,
        permission: true,
      },
    ];

    // Combine both arrays - account items followed by default items
    return [...accountItems, ...defaultItems];
  };

  if (userData?.status === 'anonymous') {
    return null;
  }

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'menu-popover' : undefined;

  return (
    <div>
      <IconButton
        aria-describedby={id}
        onClick={handleClick}
        color={props.color}
        className={props.iconButtonClassName}
      >
        <MenuIcon />
      </IconButton>
      <UsesSistent>
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          style={{ marginTop: '1rem' }}
        >
          <NavigationNavbar
            navigationItems={getAccountNavigationItems()}
            ListItemTextProps={{
              primaryTypographyProps: {
                sx: {
                  fontFamily: theme.typography.fontFamily,
                  fontSize: '1rem',
                },
              },
            }}
          />
        </Popover>
      </UsesSistent>
    </div>
  );
};

const MenuProvider = (props) => (
  <Provider store={store}>
    <HeaderMenu {...props} />
  </Provider>
);

const mapDispatchToProps = (dispatch) => ({
  updateUser: bindActionCreators(updateUser, dispatch),
});

const mapStateToProps = (state) => ({
  capabilitiesRegistry: state.get('capabilitiesRegistry'),
});

export default connect(mapStateToProps, mapDispatchToProps)(MenuProvider);
