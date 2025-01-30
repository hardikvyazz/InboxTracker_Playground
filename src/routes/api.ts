import express, { Express, NextFunction, Request, Response } from 'express';
// import {initializeController} from '../services/initialize';

const router = express.Router();

// router.post('/initialize', initializeController);

router.get('/uptime', (req:Request, res:Response, next: NextFunction)=>{
    res.send('UP AND RUNNING!');
})

export { router as apiRouter}

