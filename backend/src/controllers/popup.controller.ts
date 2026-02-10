import { Request, Response } from 'express';
import { pool } from '../config/database';

class PopupController {
    // 활성화된 팝업 가져오기 (프론트엔드용)
    async getActivePopup(req: Request, res: Response) {
        try {
            const result = await pool.query(
                `SELECT id, title, image_url, link_url, height, enabled
                 FROM popup_settings
                 WHERE enabled = true
                 ORDER BY id DESC
                 LIMIT 1`
            );

            if (result.rows.length > 0) {
                res.json({
                    success: true,
                    data: result.rows[0]
                });
            } else {
                res.json({
                    success: true,
                    data: null
                });
            }
        } catch (error) {
            console.error('팝업 조회 오류:', error);
            res.json({
                success: true,
                data: null
            });
        }
    }

    // 팝업 설정 저장/업데이트 (관리자용)
    async savePopupSettings(req: Request, res: Response) {
        try {
            const { title, image_url, link_url, height, enabled } = req.body;

            // 기존 설정이 있는지 확인
            const existing = await pool.query('SELECT id FROM popup_settings LIMIT 1');

            if (existing.rows.length > 0) {
                // 업데이트
                await pool.query(
                    `UPDATE popup_settings
                     SET title = $1, image_url = $2, link_url = $3, height = $4, enabled = $5, updated_at = NOW()
                     WHERE id = $6`,
                    [title || '', image_url || '', link_url || '', height || null, enabled ? true : false, existing.rows[0].id]
                );
            } else {
                // 새로 생성
                await pool.query(
                    `INSERT INTO popup_settings (title, image_url, link_url, height, enabled, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                    [title || '', image_url || '', link_url || '', height || null, enabled ? true : false]
                );
            }

            res.json({
                success: true,
                message: '팝업 설정이 저장되었습니다.'
            });
        } catch (error) {
            console.error('팝업 설정 저장 오류:', error);
            res.status(500).json({
                success: false,
                message: '팝업 설정 저장에 실패했습니다.'
            });
        }
    }

    // 팝업 설정 가져오기 (관리자용)
    async getPopupSettings(req: Request, res: Response) {
        try {
            const result = await pool.query(
                `SELECT id, title, image_url, link_url, height, enabled, created_at, updated_at
                 FROM popup_settings
                 ORDER BY id DESC
                 LIMIT 1`
            );

            res.json({
                success: true,
                data: result.rows.length > 0 ? result.rows[0] : null
            });
        } catch (error) {
            console.error('팝업 설정 조회 오류:', error);
            res.status(500).json({
                success: false,
                message: '팝업 설정 조회에 실패했습니다.'
            });
        }
    }
}

export const popupController = new PopupController();
