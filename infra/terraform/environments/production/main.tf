module "networking" {
  source = "../../modules/networking"

  environment = var.environment
}

module "ecr" {
  source = "../../modules/ecr"

  environment = var.environment
}

module "alb" {
  source = "../../modules/alb"

  environment           = var.environment
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  acm_certificate_arn   = var.acm_certificate_arn
}

module "secrets" {
  source = "../../modules/secrets"

  environment                = var.environment
  database_url               = var.database_url
  database_url_version       = var.database_url_version
  clerk_secret_key           = var.clerk_secret_key
  clerk_secret_key_version   = var.clerk_secret_key_version
  openrouter_api_key         = var.openrouter_api_key
  openrouter_api_key_version = var.openrouter_api_key_version
}

module "ecs" {
  source = "../../modules/ecs"

  environment                 = var.environment
  aws_region                  = var.aws_region
  desired_count               = var.desired_count
  api_image_uri               = "${module.ecr.api_repository_url}:${var.api_image_tag}"
  web_image_uri               = "${module.ecr.web_repository_url}:${var.web_image_tag}"
  public_subnet_ids           = module.networking.public_subnet_ids
  ecs_tasks_security_group_id = module.networking.ecs_tasks_security_group_id
  api_target_group_arn        = module.alb.api_target_group_arn
  web_target_group_arn        = module.alb.web_target_group_arn
  database_url_arn            = module.secrets.database_url_arn
  clerk_secret_key_arn        = module.secrets.clerk_secret_key_arn
  openrouter_api_key_arn      = module.secrets.openrouter_api_key_arn
  clerk_publishable_key       = var.clerk_publishable_key
  web_origin                  = var.web_origin
}
