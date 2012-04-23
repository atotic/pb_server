Sequel.migration do
	up do

		create_table(:users) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			String :display_name, :size=>128, :null=>false
			String :email, :size=>128
			TrueClass :is_administrator, :default=>false

			index [:email], :name => :index_users_email
		end

		create_table(:omniauth_tokens) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			Integer :user_id

			Integer :strategy # 0 developer, 1 facebook, 2 google
			String :strategy_uid, :null=>false, :size=>128 # unique user id per strategy
			String :auth_data, :text=>true # JSON created by omniauth

			index [:strategy], :name => :index_omniauth_strategy
			index [:strategy_uid], :name => :index_omniauth_uid
			index [:user_id], :name => :index_omniauth_user
		end

		create_table(:browser_commands, :ignore_index_errors=>true) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			String :payload, :text=>true # command-specific json payload
			String :type, :size=>128 # used by js to execute commands in browser
			Integer :book_id, :null=>false
			
			index [:book_id], :name=>:index_server_commands_book
		end
		
	end
	
	down do
		drop_table(:auth_logins, :server_commands, :users)
	end
end
