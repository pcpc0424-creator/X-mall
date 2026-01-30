import { Response } from 'express';
import { userService } from '../services/user.service';
import { pointService } from '../services/point.service';
import { rpayService } from '../services/rpay.service';
import { AuthRequest, AdminAuthRequest } from '../types';
import { parseMembersExcel } from '../utils/excel';

export class UserController {
  // Get current user profile
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const user = await userService.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다.'
        });
      }

      // Get balances
      const balances = await pointService.getBalances(userId);

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          grade: user.grade,
          created_at: user.created_at,
          balances
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get all users
  async getUsers(req: AdminAuthRequest, res: Response) {
    try {
      const { page, limit, grade, search } = req.query;

      const result = await userService.getUsers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        grade: grade as 'dealer' | 'consumer' | undefined,
        search: search as string | undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get user by ID with balances
  async getUserById(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = await userService.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다.'
        });
      }

      const balances = await pointService.getBalances(id);

      res.json({
        success: true,
        data: {
          ...user,
          password_hash: undefined,
          balances
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Create user with grade
  async createUser(req: AdminAuthRequest, res: Response) {
    try {
      const { email, password, name, phone, grade, referrer_email } = req.body;

      if (!email || !password || !name || !phone) {
        return res.status(400).json({
          success: false,
          error: '이메일, 비밀번호, 이름, 전화번호는 필수입니다.'
        });
      }

      // Validate referrer if provided
      let referrerId: string | undefined;
      if (referrer_email) {
        const referrer = await userService.findDealerByEmail(referrer_email);
        if (!referrer) {
          return res.status(400).json({
            success: false,
            error: '존재하지 않는 추천인이거나 대리점이 아닙니다.'
          });
        }
        referrerId = referrer.id;
      }

      const user = await userService.createUser(
        { email, password, name, phone },
        grade || 'consumer',
        referrerId
      );

      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          grade: user.grade
        },
        message: '회원이 등록되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Update user grade
  async updateGrade(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { grade } = req.body;

      if (!grade || !['dealer', 'consumer'].includes(grade)) {
        return res.status(400).json({
          success: false,
          error: '유효한 등급을 입력해주세요. (dealer 또는 consumer)'
        });
      }

      const user = await userService.updateGrade(id, grade);

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          grade: user.grade
        },
        message: '등급이 변경되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Deactivate user
  async deactivateUser(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await userService.deactivateUser(id);

      res.json({
        success: true,
        message: '회원이 비활성화되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Bulk upload users
  async bulkUpload(req: AdminAuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '엑셀 파일을 업로드해주세요.'
        });
      }

      // Parse Excel file
      const parseResult = parseMembersExcel(req.file.buffer);

      if (parseResult.data.length === 0 && parseResult.errors.length === 0) {
        return res.status(400).json({
          success: false,
          error: '엑셀 파일에 데이터가 없습니다.'
        });
      }

      // Combine parse errors
      const allErrors = parseResult.errors.map(e => ({
        row: e.row,
        email: '',
        error: e.message
      }));

      // Bulk create users
      const bulkResult = await userService.bulkCreateUsers(parseResult.data);

      // Merge errors
      const finalErrors = [...allErrors, ...bulkResult.errors];

      res.json({
        success: true,
        data: {
          total: parseResult.data.length + parseResult.errors.length,
          success_count: bulkResult.success_count,
          fail_count: parseResult.errors.length + bulkResult.fail_count,
          errors: finalErrors.slice(0, 100) // Limit error list
        },
        message: `총 ${bulkResult.success_count}명의 회원이 등록되었습니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || '파일 처리 중 오류가 발생했습니다.'
      });
    }
  }

  // Admin: Get all dealers for referrer selection
  async getDealers(req: AdminAuthRequest, res: Response) {
    try {
      const { page, limit, search } = req.query;

      const result = await userService.getDealers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get genealogy for a specific dealer
  async getGenealogyByDealerId(req: AdminAuthRequest, res: Response) {
    try {
      const { dealerId } = req.params;
      const { page, limit, search } = req.query;

      // Verify the user is a dealer
      const dealer = await userService.findById(dealerId);
      if (!dealer) {
        return res.status(404).json({
          success: false,
          error: '대리점을 찾을 수 없습니다.'
        });
      }

      if (dealer.grade !== 'dealer') {
        return res.status(400).json({
          success: false,
          error: '해당 회원은 대리점이 아닙니다.'
        });
      }

      const result = await userService.getGenealogy(dealerId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // User (dealer): Get my genealogy
  async getMyGenealogy(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userGrade = req.user!.grade;

      if (userGrade !== 'dealer') {
        return res.status(403).json({
          success: false,
          error: '대리점 회원만 계보도를 조회할 수 있습니다.'
        });
      }

      const { page, limit, search } = req.query;

      const result = await userService.getGenealogy(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const userController = new UserController();
