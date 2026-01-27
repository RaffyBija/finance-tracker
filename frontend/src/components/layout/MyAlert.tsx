import Slide from '@mui/material/Slide';
import Alert from '@mui/material/Alert'

import type {AlertPopUp} from '../../types/index'
interface MyAlertProp{
    AlertConfig: AlertPopUp
}

export default function MyAlert({AlertConfig}:MyAlertProp){
    return(
        <>
            <Slide
                in={AlertConfig.checked}   
                direction='up' 
            >
                    {/*@ts-ignore*/}

                <Alert severity={AlertConfig.tipo}>
                    {AlertConfig.messaggio}
                </Alert>
            </Slide>
        </>

    );

}