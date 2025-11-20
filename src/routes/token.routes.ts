import { Router } from 'express';
import { TokenController } from '../controllers/token.controller';
import { AggregatorService } from '../services/aggregator.service';

const router = Router();
const aggregatorService = new AggregatorService();
const tokenController = new TokenController(aggregatorService);

// Initialize aggregator service
aggregatorService.initialize();

// Routes
router.get('/tokens', (req, res) => tokenController.getTokens(req, res));
router.get('/tokens/search', (req, res) => tokenController.searchTokens(req, res));
router.get('/tokens/:address', (req, res) => tokenController.getTokenByAddress(req, res));
router.get('/health', (req, res) => tokenController.healthCheck(req, res));

export { router as tokenRoutes, aggregatorService };